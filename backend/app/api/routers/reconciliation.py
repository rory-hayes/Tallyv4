from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import (
    BankTransaction,
    JournalLine,
    MatchGroup,
    MatchGroupLink,
    PayrollSummary,
    User,
    Variance,
)
from app.models.enums import RunStatus, Severity, VarianceStatus
from app.schemas.reconciliation import (
    ApproveVarianceRequest,
    ReconcileResponse,
    ResolveVarianceRequest,
    VarianceResponse,
)
from app.schemas.run import RunSummaryResponse
from app.services.audit_service import log_event
from app.services.reconciliation_engine import (
    EngineBankTx,
    EngineJournalLine,
    EnginePayrollSummary,
    reconcile,
)
from app.services.variance_state_machine import enforce_transition
from app.services.variance_taxonomy import get_definition
from app.utils.access import require_run_access

router = APIRouter()


@router.post("/runs/{run_id}/reconcile", response_model=ReconcileResponse)
def reconcile_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReconcileResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)

    payroll_rows = db.query(PayrollSummary).filter(PayrollSummary.run_id == run.id).all()
    bank_rows = db.query(BankTransaction).filter(BankTransaction.run_id == run.id).all()
    journal_rows = db.query(JournalLine).filter(JournalLine.run_id == run.id).all()

    engine_result = reconcile(
        country_pack=run.country_pack,
        run_currency=run.currency,
        pay_date=run.pay_date,
        amount_tolerance=Decimal(str(get_settings().amount_tolerance)),
        date_window_business_days=get_settings().date_window_business_days,
        payroll_summaries=[
            EnginePayrollSummary(
                id=payroll.id,
                pay_date=payroll.pay_date,
                gross_total=Decimal(payroll.gross_total),
                net_pay_total=Decimal(payroll.net_pay_total),
                employer_taxes=Decimal(payroll.employer_taxes or 0),
                employee_taxes=Decimal(payroll.employee_taxes or 0),
                pension=Decimal(payroll.pension or 0),
                fees=Decimal(payroll.fees or 0),
                currency=payroll.currency,
            )
            for payroll in payroll_rows
        ],
        bank_transactions=[
            EngineBankTx(
                id=row.id,
                posting_date=row.posting_date,
                amount=Decimal(row.amount),
                description=row.description,
                reference=row.reference,
                currency=row.currency,
                account_id=row.account_id,
            )
            for row in bank_rows
        ],
        journal_lines=[
            EngineJournalLine(
                id=row.id,
                journal_date=row.journal_date,
                account_code=row.account_code,
                debit=Decimal(row.debit),
                credit=Decimal(row.credit),
                memo=row.memo,
                currency=row.currency,
            )
            for row in journal_rows
        ],
        today=date.today(),
    )

    db.execute(delete(Variance).where(Variance.run_id == run.id))
    db.execute(delete(MatchGroup).where(MatchGroup.run_id == run.id))

    for variance in engine_result.variances:
        db.add(
            Variance(
                run_id=run.id,
                code=variance.code,
                title=variance.title,
                severity=variance.severity,
                status=VarianceStatus.OPEN,
                amount=variance.amount,
                trigger_snapshot=variance.trigger_snapshot,
                default_action=variance.default_action,
            )
        )

    for group in engine_result.match_groups:
        match_group = MatchGroup(
            run_id=run.id,
            match_type=group.match_type,
            confidence=float(group.confidence),
            is_manual=False,
        )
        db.add(match_group)
        db.flush()
        for link in group.record_links:
            db.add(
                MatchGroupLink(
                    match_group_id=match_group.id,
                    record_type=link["record_type"],
                    record_id=link["record_id"],
                    amount=Decimal(link["amount"]),
                )
            )

    run.status = engine_result.status
    log_event(
        db,
        actor=current_user,
        event_type="run.reconciled",
        run_id=run.id,
        client_id=run.client_id,
        details={
            "status": run.status.value,
            "variance_count": len(engine_result.variances),
            "match_groups": len(engine_result.match_groups),
        },
    )

    db.commit()
    return ReconcileResponse(
        run_id=run.id,
        status=run.status,
        matched_groups=len(engine_result.match_groups),
        created_variances=len(engine_result.variances),
    )


@router.get("/runs/{run_id}/summary", response_model=RunSummaryResponse)
def get_run_summary(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunSummaryResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)

    payroll_total = sum((Decimal(row.net_pay_total) for row in db.query(PayrollSummary).filter(PayrollSummary.run_id == run.id).all()), Decimal("0"))
    bank_total = sum((Decimal(row.amount).copy_abs() for row in db.query(BankTransaction).filter(BankTransaction.run_id == run.id, BankTransaction.amount < 0).all()), Decimal("0"))
    gl_total = sum((Decimal(row.debit) for row in db.query(JournalLine).filter(JournalLine.run_id == run.id).all()), Decimal("0"))

    variances = db.query(Variance).filter(Variance.run_id == run.id).all()
    variance_total = sum((Decimal(variance.amount or 0) for variance in variances), Decimal("0"))
    unresolved_blockers = sum(
        1
        for variance in variances
        if variance.severity == Severity.BLOCKER and variance.status not in {VarianceStatus.APPROVED, VarianceStatus.CLOSED}
    )

    return RunSummaryResponse(
        run_id=run.id,
        status=run.status,
        payroll_total=float(payroll_total),
        bank_total=float(bank_total),
        gl_total=float(gl_total),
        variance_total=float(variance_total),
        unresolved_blockers=unresolved_blockers,
    )


@router.get("/runs/{run_id}/variances", response_model=list[VarianceResponse])
def list_variances(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[VarianceResponse]:
    run = require_run_access(db, run_id=run_id, user=current_user)
    variances = db.query(Variance).filter(Variance.run_id == run.id).order_by(Variance.created_at.asc()).all()
    return [VarianceResponse.model_validate(variance) for variance in variances]


@router.post("/variances/{variance_id}/resolve", response_model=VarianceResponse)
def resolve_variance(
    variance_id: str,
    payload: ResolveVarianceRequest,
    allow_ignore_policy: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VarianceResponse:
    variance = db.get(Variance, variance_id)
    if variance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variance not found")

    run = require_run_access(db, run_id=variance.run_id, user=current_user)
    definition = get_definition(variance.code)

    if payload.status not in definition.allowed_resolution_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status {payload.status.value} not allowed for variance code {variance.code}",
        )

    try:
        enforce_transition(
            current=variance.status,
            target=payload.status,
            allow_ignore=allow_ignore_policy,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    variance.status = payload.status
    variance.resolution_note = payload.note
    if payload.explanation:
        variance.explanation = payload.explanation

    run.status = RunStatus.NEEDS_REVIEW

    log_event(
        db,
        actor=current_user,
        event_type="variance.resolved",
        run_id=variance.run_id,
        client_id=run.client_id,
        details={"variance_id": variance.id, "status": variance.status.value},
    )
    db.commit()
    db.refresh(variance)
    return VarianceResponse.model_validate(variance)


@router.post("/variances/{variance_id}/approve", response_model=VarianceResponse)
def approve_variance(
    variance_id: str,
    payload: ApproveVarianceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VarianceResponse:
    variance = db.get(Variance, variance_id)
    if variance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variance not found")

    run = require_run_access(db, run_id=variance.run_id, user=current_user)

    try:
        enforce_transition(current=variance.status, target=VarianceStatus.APPROVED, allow_ignore=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    variance.status = VarianceStatus.APPROVED
    variance.approved_by = current_user.id
    variance.approved_at = datetime.now(timezone.utc)
    if payload.note:
        variance.resolution_note = payload.note

    remaining_blockers = (
        db.query(Variance)
        .filter(
            Variance.run_id == variance.run_id,
            Variance.severity == Severity.BLOCKER,
            Variance.status.notin_([VarianceStatus.APPROVED, VarianceStatus.CLOSED]),
        )
        .count()
    )
    run.status = RunStatus.TIED if remaining_blockers == 0 else RunStatus.NEEDS_REVIEW

    log_event(
        db,
        actor=current_user,
        event_type="variance.approved",
        run_id=variance.run_id,
        client_id=run.client_id,
        details={"variance_id": variance.id},
    )

    db.commit()
    db.refresh(variance)
    return VarianceResponse.model_validate(variance)
