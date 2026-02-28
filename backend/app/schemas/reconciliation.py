from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import RunStatus, Severity, VarianceStatus


class ReconcileResponse(BaseModel):
    run_id: str
    status: RunStatus
    matched_groups: int
    created_variances: int


class VarianceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    code: str
    title: str
    severity: Severity
    status: VarianceStatus
    amount: float | None
    default_action: str
    explanation: str | None
    resolution_note: str | None
    trigger_snapshot: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ResolveVarianceRequest(BaseModel):
    status: VarianceStatus
    note: str | None = None
    explanation: str | None = None


class ApproveVarianceRequest(BaseModel):
    note: str | None = None
