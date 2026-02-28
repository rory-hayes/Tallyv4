from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import CountryPack, RunStatus


class RunCreateRequest(BaseModel):
    pay_period_start: date
    pay_period_end: date
    pay_date: date
    currency: str
    country_pack: CountryPack


class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    pay_period_start: date
    pay_period_end: date
    pay_date: date
    currency: str
    country_pack: CountryPack
    status: RunStatus
    rule_version: str
    created_at: datetime
    updated_at: datetime


class RunApprovalAction(BaseModel):
    note: str | None = None


class RunSummaryResponse(BaseModel):
    run_id: str
    status: RunStatus
    payroll_total: float
    bank_total: float
    gl_total: float
    variance_total: float
    unresolved_blockers: int
