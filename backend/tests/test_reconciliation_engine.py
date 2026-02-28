from datetime import date
from decimal import Decimal

from app.models.enums import CountryPack, RunStatus
from app.services.reconciliation_engine import EngineBankTx, EngineJournalLine, EnginePayrollSummary, reconcile


def _base_inputs() -> tuple[list[EnginePayrollSummary], list[EngineBankTx], list[EngineJournalLine]]:
    payroll = [
        EnginePayrollSummary(
            id="payroll-1",
            pay_date=date(2026, 1, 31),
            gross_total=Decimal("150.00"),
            net_pay_total=Decimal("100.00"),
            employer_taxes=Decimal("0.00"),
            employee_taxes=Decimal("0.00"),
            pension=Decimal("0.00"),
            fees=Decimal("0.00"),
            currency="GBP",
        )
    ]
    bank = [
        EngineBankTx(
            id="bank-1",
            posting_date=date(2026, 1, 31),
            amount=Decimal("-100.00"),
            description="Payroll batch",
            reference="ABC123",
            currency="GBP",
            account_id="main",
        )
    ]
    journal = [
        EngineJournalLine(
            id="gl-1",
            journal_date=date(2026, 1, 31),
            account_code="1200-bank",
            debit=Decimal("150.00"),
            credit=Decimal("150.00"),
            memo="Payroll",
            currency="GBP",
        )
    ]
    return payroll, bank, journal


def test_reconciliation_deterministic() -> None:
    payroll, bank, journal = _base_inputs()

    result_a = reconcile(
        country_pack=CountryPack.UK,
        run_currency="GBP",
        pay_date=date(2026, 1, 31),
        amount_tolerance=Decimal("0.01"),
        date_window_business_days=2,
        payroll_summaries=payroll,
        bank_transactions=bank,
        journal_lines=journal,
        today=date(2026, 2, 1),
    )
    result_b = reconcile(
        country_pack=CountryPack.UK,
        run_currency="GBP",
        pay_date=date(2026, 1, 31),
        amount_tolerance=Decimal("0.01"),
        date_window_business_days=2,
        payroll_summaries=payroll,
        bank_transactions=bank,
        journal_lines=journal,
        today=date(2026, 2, 1),
    )

    assert result_a.status == RunStatus.TIED
    assert result_b.status == RunStatus.TIED
    assert [variance.code for variance in result_a.variances] == [variance.code for variance in result_b.variances]
    assert [group.match_type for group in result_a.match_groups] == [group.match_type for group in result_b.match_groups]


def test_missing_bank_creates_blocker() -> None:
    payroll, _, journal = _base_inputs()

    result = reconcile(
        country_pack=CountryPack.UK,
        run_currency="GBP",
        pay_date=date(2026, 1, 31),
        amount_tolerance=Decimal("0.01"),
        date_window_business_days=2,
        payroll_summaries=payroll,
        bank_transactions=[],
        journal_lines=journal,
        today=date(2026, 2, 1),
    )

    codes = [variance.code for variance in result.variances]
    assert "RUN-003" in codes
    assert result.status == RunStatus.NOT_TIED
