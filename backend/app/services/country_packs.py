from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from app.core.config import get_settings
from app.models.enums import CountryPack


@dataclass(frozen=True)
class LiabilitySchedule:
    due_date: date
    code: str
    status_hint: str


def month_end(year: int, month: int) -> date:
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


def uk_hmrc_due_date(pay_date: date) -> date:
    if pay_date.month == 12:
        return date(pay_date.year + 1, 1, get_settings().uk_hmrc_due_day)
    return date(pay_date.year, pay_date.month + 1, get_settings().uk_hmrc_due_day)


def ie_revenue_due_date(pay_date: date, ros_enabled: bool = True) -> date:
    settings = get_settings()
    last_day = month_end(pay_date.year, pay_date.month)
    days = settings.ie_due_days_ros if ros_enabled else settings.ie_due_days_offline
    return last_day + timedelta(days=days)


def liability_schedule(country_pack: CountryPack, pay_date: date) -> LiabilitySchedule:
    if country_pack == CountryPack.UK:
        return LiabilitySchedule(
            due_date=uk_hmrc_due_date(pay_date),
            code="TIME-001",
            status_hint="HMRC liability expected by due date",
        )

    return LiabilitySchedule(
        due_date=ie_revenue_due_date(pay_date, ros_enabled=True),
        code="TIME-001",
        status_hint="Revenue liability expected by due date",
    )


def classify_liability_variance(country_pack: CountryPack, pay_date: date, today: date, payment_found: bool) -> tuple[str, str] | None:
    if payment_found:
        return None

    schedule = liability_schedule(country_pack, pay_date)
    if today <= schedule.due_date:
        return ("TIME-001", f"Liability payment is expected later; due by {schedule.due_date.isoformat()}.")
    return ("TIME-002", f"Liability payment is overdue since {schedule.due_date.isoformat()}.")
