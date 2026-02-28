from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkRequestResponse(BaseModel):
    message: str
    expires_at: datetime
    delivery_mode: str
    magic_link: str | None = None
    verification_token: str | None = None


class MagicLinkVerifyRequest(BaseModel):
    token: str


class UserIdentity(BaseModel):
    id: str
    email: EmailStr


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserIdentity
