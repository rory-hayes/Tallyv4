from datetime import date

from app.models.enums import CountryPack
from app.services.country_packs import classify_liability_variance, ie_revenue_due_date, uk_hmrc_due_date


def test_uk_due_date() -> None:
    assert uk_hmrc_due_date(date(2026, 1, 15)) == date(2026, 2, 22)


def test_ie_due_date_ros() -> None:
    assert ie_revenue_due_date(date(2026, 1, 15), ros_enabled=True) == date(2026, 2, 23)


def test_expected_later_classification() -> None:
    result = classify_liability_variance(
        country_pack=CountryPack.UK,
        pay_date=date(2026, 1, 15),
        today=date(2026, 2, 10),
        payment_found=False,
    )
    assert result is not None
    assert result[0] == "TIME-001"


def test_overdue_classification() -> None:
    result = classify_liability_variance(
        country_pack=CountryPack.IE,
        pay_date=date(2026, 1, 15),
        today=date(2026, 3, 1),
        payment_found=False,
    )
    assert result is not None
    assert result[0] == "TIME-002"
