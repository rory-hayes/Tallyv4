from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from app.models.enums import CountryPack, RunStatus, Severity
from app.services.country_packs import classify_liability_variance
from app.services.variance_taxonomy import get_definition


@dataclass
class EngineBankTx:
    id: str
    posting_date: date
    amount: Decimal
    description: str
    reference: str | None
    currency: str | None
    account_id: str | None


@dataclass
class EnginePayrollSummary:
    id: str
    pay_date: date
    gross_total: Decimal
    net_pay_total: Decimal
    employer_taxes: Decimal
    employee_taxes: Decimal
    pension: Decimal
    fees: Decimal
    currency: str | None


@dataclass
class EngineJournalLine:
    id: str
    journal_date: date
    account_code: str
    debit: Decimal
    credit: Decimal
    memo: str | None
    currency: str | None


@dataclass
class EngineVariance:
    code: str
    title: str
    severity: Severity
    amount: Decimal | None
    trigger_snapshot: dict[str, Any]
    default_action: str


@dataclass
class EngineMatchGroup:
    match_type: str
    confidence: Decimal
    record_links: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class EngineResult:
    status: RunStatus
    variances: list[EngineVariance]
    match_groups: list[EngineMatchGroup]
    payroll_total: Decimal
    bank_total: Decimal
    gl_total: Decimal


def _business_days_between(target: date, reference: date) -> int:
    start, end = sorted([target, reference])
    days = 0
    cursor = start
    while cursor <= end:
        if cursor.weekday() < 5:
            days += 1
        cursor += timedelta(days=1)
    return days - 1


def _add_variance(
    variances: list[EngineVariance],
    *,
    code: str,
    amount: Decimal | None = None,
    snapshot: dict[str, Any] | None = None,
) -> None:
    definition = get_definition(code)
    variances.append(
        EngineVariance(
            code=definition.code,
            title=definition.title,
            severity=definition.severity,
            amount=amount,
            trigger_snapshot=snapshot or {},
            default_action=definition.default_action,
        )
    )


def reconcile(
    *,
    country_pack: CountryPack,
    run_currency: str,
    pay_date: date,
    amount_tolerance: Decimal,
    date_window_business_days: int,
    payroll_summaries: list[EnginePayrollSummary],
    bank_transactions: list[EngineBankTx],
    journal_lines: list[EngineJournalLine],
    today: date,
) -> EngineResult:
    variances: list[EngineVariance] = []
    match_groups: list[EngineMatchGroup] = []

    if not payroll_summaries or not bank_transactions or not journal_lines:
        _add_variance(
            variances,
            code="RUN-003",
            snapshot={
                "payroll_rows": len(payroll_summaries),
                "bank_rows": len(bank_transactions),
                "journal_rows": len(journal_lines),
            },
        )

    if not payroll_summaries:
        return EngineResult(
            status=RunStatus.NOT_TIED,
            variances=variances,
            match_groups=match_groups,
            payroll_total=Decimal("0.00"),
            bank_total=Decimal("0.00"),
            gl_total=Decimal("0.00"),
        )

    payroll = payroll_summaries[0]
    payroll_total = payroll.net_pay_total

    observed_currencies = {
        value.upper()
        for value in ([payroll.currency] + [tx.currency for tx in bank_transactions] + [jl.currency for jl in journal_lines])
        if value
    }
    if len(observed_currencies) > 1 or (observed_currencies and run_currency.upper() not in observed_currencies):
        _add_variance(
            variances,
            code="CUR-001",
            snapshot={"observed_currencies": sorted(observed_currencies), "run_currency": run_currency},
        )

    # Bank matching
    outflows = [tx for tx in bank_transactions if tx.amount < 0]
    outflow_abs_total = sum((tx.amount.copy_abs() for tx in outflows), Decimal("0.00"))
    bank_total = outflow_abs_total

    in_window = [
        tx for tx in outflows if _business_days_between(tx.posting_date, pay_date) <= date_window_business_days
    ]
    exact_in_window = [
        tx for tx in in_window if (tx.amount.copy_abs() - payroll.net_pay_total).copy_abs() <= amount_tolerance
    ]

    matched_sum = Decimal("0.00")
    if len(exact_in_window) == 1:
        tx = exact_in_window[0]
        matched_sum = tx.amount.copy_abs()
        match_groups.append(
            EngineMatchGroup(
                match_type="exact_one_to_one",
                confidence=Decimal("1.0"),
                record_links=[
                    {"record_type": "payroll", "record_id": payroll.id, "amount": str(payroll.net_pay_total)},
                    {"record_type": "bank", "record_id": tx.id, "amount": str(tx.amount.copy_abs())},
                ],
            )
        )
    elif len(exact_in_window) > 1:
        _add_variance(
            variances,
            code="BNK-011",
            amount=payroll.net_pay_total,
            snapshot={"candidate_bank_ids": [tx.id for tx in exact_in_window]},
        )
    else:
        summed_in_window = sum((tx.amount.copy_abs() for tx in in_window), Decimal("0.00"))
        if in_window and (summed_in_window - payroll.net_pay_total).copy_abs() <= amount_tolerance:
            matched_sum = summed_in_window
            _add_variance(
                variances,
                code="BNK-003",
                amount=payroll.net_pay_total,
                snapshot={"candidate_bank_ids": [tx.id for tx in in_window]},
            )
            match_groups.append(
                EngineMatchGroup(
                    match_type="one_to_many",
                    confidence=Decimal("0.92"),
                    record_links=[
                        {"record_type": "payroll", "record_id": payroll.id, "amount": str(payroll.net_pay_total)},
                        *[
                            {
                                "record_type": "bank",
                                "record_id": tx.id,
                                "amount": str(tx.amount.copy_abs()),
                            }
                            for tx in in_window
                        ],
                    ],
                )
            )
        else:
            outside_window_exact = [
                tx
                for tx in outflows
                if _business_days_between(tx.posting_date, pay_date) > date_window_business_days
                and (tx.amount.copy_abs() - payroll.net_pay_total).copy_abs() <= amount_tolerance
            ]
            if outside_window_exact:
                _add_variance(
                    variances,
                    code="BNK-006",
                    amount=payroll.net_pay_total,
                    snapshot={"candidate_bank_ids": [tx.id for tx in outside_window_exact]},
                )
            elif in_window:
                nearest = min(in_window, key=lambda tx: (tx.amount.copy_abs() - payroll.net_pay_total).copy_abs())
                delta = (nearest.amount.copy_abs() - payroll.net_pay_total)
                if delta < 0:
                    _add_variance(
                        variances,
                        code="BNK-004",
                        amount=delta.copy_abs(),
                        snapshot={"bank_tx_id": nearest.id, "expected": str(payroll.net_pay_total), "actual": str(nearest.amount.copy_abs())},
                    )
                elif delta > 0:
                    _add_variance(
                        variances,
                        code="BNK-005",
                        amount=delta,
                        snapshot={"bank_tx_id": nearest.id, "expected": str(payroll.net_pay_total), "actual": str(nearest.amount.copy_abs())},
                    )
                else:
                    _add_variance(
                        variances,
                        code="BNK-002",
                        snapshot={"bank_tx_id": nearest.id},
                    )
            else:
                _add_variance(
                    variances,
                    code="BNK-001",
                    amount=payroll.net_pay_total,
                    snapshot={"payroll_id": payroll.id},
                )

    if matched_sum and (matched_sum - payroll.net_pay_total).copy_abs() > amount_tolerance:
        _add_variance(
            variances,
            code="ROUND-001",
            amount=(matched_sum - payroll.net_pay_total).copy_abs(),
            snapshot={"matched_sum": str(matched_sum), "expected": str(payroll.net_pay_total)},
        )

    # GL checks
    gl_debit_total = sum((line.debit for line in journal_lines), Decimal("0.00"))
    gl_credit_total = sum((line.credit for line in journal_lines), Decimal("0.00"))
    gl_total = gl_debit_total

    if not journal_lines:
        _add_variance(variances, code="GL-001", snapshot={"reason": "No journal lines provided"})
    else:
        if (gl_debit_total - gl_credit_total).copy_abs() > amount_tolerance:
            _add_variance(
                variances,
                code="GL-002",
                amount=(gl_debit_total - gl_credit_total).copy_abs(),
                snapshot={"debits": str(gl_debit_total), "credits": str(gl_credit_total)},
            )

        if (gl_debit_total - payroll.gross_total).copy_abs() > amount_tolerance:
            _add_variance(
                variances,
                code="GL-003",
                amount=(gl_debit_total - payroll.gross_total).copy_abs(),
                snapshot={"gl_total": str(gl_debit_total), "payroll_gross": str(payroll.gross_total)},
            )

    gl_has_cash_account = any(
        token in (line.account_code or "").lower() for line in journal_lines for token in ("bank", "cash", "1200", "1000")
    )
    if outflows and not gl_has_cash_account:
        _add_variance(variances, code="X-001", snapshot={"bank_outflows": len(outflows)})
    if gl_has_cash_account and not outflows:
        _add_variance(variances, code="X-002", snapshot={"gl_lines": len(journal_lines)})

    if outflows and journal_lines and any(v.code.startswith("GL-") for v in variances):
        _add_variance(variances, code="X-003", snapshot={"note": "Bank ties but GL mismatch remains"})

    liability_amount = payroll.employee_taxes + payroll.employer_taxes
    if liability_amount > Decimal("0"):
        liability_payment_found = any(
            keyword in tx.description.lower() for tx in bank_transactions for keyword in ("hmrc", "revenue", "paye", "prsi", "usc")
        )
        liability_classification = classify_liability_variance(
            country_pack=country_pack,
            pay_date=payroll.pay_date,
            today=today,
            payment_found=liability_payment_found,
        )
        if liability_classification:
            code, message = liability_classification
            _add_variance(
                variances,
                code=code,
                amount=liability_amount,
                snapshot={"liability_amount": str(liability_amount), "note": message},
            )

    unresolved_blockers = sum(1 for variance in variances if variance.severity == Severity.BLOCKER)
    if unresolved_blockers:
        status = RunStatus.NOT_TIED
    elif variances:
        status = RunStatus.NEEDS_REVIEW
    else:
        status = RunStatus.TIED

    return EngineResult(
        status=status,
        variances=variances,
        match_groups=match_groups,
        payroll_total=payroll_total,
        bank_total=bank_total,
        gl_total=gl_total,
    )
