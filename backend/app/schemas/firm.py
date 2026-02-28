from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import FirmRole


class FirmCreateRequest(BaseModel):
    name: str


class FirmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime


class FirmUserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: FirmRole


class MembershipResponse(BaseModel):
    id: str
    firm_id: str
    user_id: str
    role: FirmRole
