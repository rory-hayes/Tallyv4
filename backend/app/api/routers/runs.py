from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Approval, Client, FirmMembership, Run, User, Variance
from app.models.enums import ApprovalStatus, FirmRole, RunStatus, Severity, VarianceStatus
from app.schemas.run import RunApprovalAction, RunCreateRequest, RunResponse
from app.services.audit_service import log_event
from app.utils.access import require_client_access, require_run_access

router = APIRouter()


@router.post("/clients/{client_id}/runs", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
def create_run(
    client_id: str,
    payload: RunCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunResponse:
    client = require_client_access(db, client_id=client_id, user=current_user)

    run = Run(
        client_id=client.id,
        pay_period_start=payload.pay_period_start,
        pay_period_end=payload.pay_period_end,
        pay_date=payload.pay_date,
        currency=payload.currency.upper(),
        country_pack=payload.country_pack,
        status=RunStatus.NEEDS_REVIEW,
    )
    db.add(run)
    db.flush()

    db.add(Approval(run_id=run.id, status=ApprovalStatus.DRAFT))
    log_event(
        db,
        actor=current_user,
        event_type="run.created",
        firm_id=client.firm_id,
        client_id=client.id,
        run_id=run.id,
        details={
            "pay_period_start": payload.pay_period_start.isoformat(),
            "pay_period_end": payload.pay_period_end.isoformat(),
            "pay_date": payload.pay_date.isoformat(),
            "currency": run.currency,
        },
    )

    db.commit()
    db.refresh(run)
    return RunResponse.model_validate(run)


@router.get("/runs/{run_id}", response_model=RunResponse)
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)
    return RunResponse.model_validate(run)


@router.post("/runs/{run_id}/submit-for-review", response_model=RunResponse)
def submit_run_for_review(
    run_id: str,
    payload: RunApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)

    approval = db.query(Approval).filter(Approval.run_id == run.id).order_by(Approval.id.desc()).first()
    if approval is None:
        approval = Approval(run_id=run.id)
        db.add(approval)

    approval.status = ApprovalStatus.SUBMITTED
    approval.submitted_by = current_user.id
    approval.submitted_at = datetime.now(timezone.utc)
    approval.note = payload.note

    run.status = RunStatus.NEEDS_REVIEW
    log_event(
        db,
        actor=current_user,
        event_type="run.submitted_for_review",
        run_id=run.id,
        client_id=run.client_id,
        details={"note": payload.note},
    )

    db.commit()
    db.refresh(run)
    return RunResponse.model_validate(run)


@router.post("/runs/{run_id}/approve", response_model=RunResponse)
def approve_run(
    run_id: str,
    payload: RunApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)
    client = db.get(Client, run.client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found for run")

    membership = (
        db.query(FirmMembership)
        .filter(FirmMembership.firm_id == client.firm_id, FirmMembership.user_id == current_user.id)
        .first()
    )
    if membership is None or membership.role not in {FirmRole.ADMIN, FirmRole.REVIEWER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only reviewers or admins can approve runs")

    unresolved_blockers = (
        db.query(Variance)
        .filter(
            Variance.run_id == run.id,
            Variance.severity == Severity.BLOCKER,
            Variance.status.in_([VarianceStatus.OPEN, VarianceStatus.MATCHED, VarianceStatus.EXPLAINED, VarianceStatus.EXPECTED_LATER]),
        )
        .count()
    )
    if unresolved_blockers:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Run has unresolved blocker variances and cannot be approved",
        )

    approval = db.query(Approval).filter(Approval.run_id == run.id).order_by(Approval.id.desc()).first()
    if approval is None:
        approval = Approval(run_id=run.id)
        db.add(approval)

    approval.status = ApprovalStatus.APPROVED
    approval.approved_by = current_user.id
    approval.approved_at = datetime.now(timezone.utc)
    approval.note = payload.note

    remaining_open = (
        db.query(Variance)
        .filter(Variance.run_id == run.id, Variance.status.in_([VarianceStatus.OPEN, VarianceStatus.MATCHED]))
        .count()
    )

    run.status = RunStatus.TIED if remaining_open == 0 else RunStatus.NEEDS_REVIEW
    log_event(
        db,
        actor=current_user,
        event_type="run.approved",
        run_id=run.id,
        client_id=run.client_id,
        details={"note": payload.note, "remaining_open": remaining_open},
    )

    db.commit()
    db.refresh(run)
    return RunResponse.model_validate(run)
