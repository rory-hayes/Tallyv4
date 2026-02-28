from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import MagicLinkToken, User
from app.schemas.auth import AccessTokenResponse, MagicLinkRequest, MagicLinkRequestResponse, MagicLinkVerifyRequest, UserIdentity
from app.services.auth_service import create_access_token, create_magic_link_token, verify_magic_link_token

router = APIRouter()


@router.post("/magic-link/request", response_model=MagicLinkRequestResponse)
def request_magic_link(payload: MagicLinkRequest, db: Session = Depends(get_db)) -> MagicLinkRequestResponse:
    token, expires_at = create_magic_link_token(payload.email.lower())
    db.add(MagicLinkToken(email=payload.email.lower(), token=token, expires_at=expires_at))
    db.commit()

    return MagicLinkRequestResponse(
        message="Magic link generated. Deliver this URL through your email provider in production.",
        expires_at=expires_at,
        magic_link=f"https://app.tally.local/auth/verify?token={token}",
    )


@router.post("/magic-link/verify", response_model=AccessTokenResponse)
def verify_magic_link(payload: MagicLinkVerifyRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    token_row = (
        db.query(MagicLinkToken)
        .filter(MagicLinkToken.token == payload.token)
        .order_by(MagicLinkToken.created_at.desc())
        .one_or_none()
    )
    if token_row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token not found")

    if token_row.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token already used")

    if token_row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expired")

    try:
        email = verify_magic_link_token(payload.token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user = db.query(User).filter(User.email == email.lower()).one_or_none()
    if user is None:
        user = User(email=email.lower())
        db.add(user)
        db.flush()

    token_row.used_at = datetime.now(timezone.utc)
    access_token, expires_at = create_access_token(user.id, user.email)
    db.commit()

    return AccessTokenResponse(
        access_token=access_token,
        expires_at=expires_at,
        user=UserIdentity(id=user.id, email=user.email),
    )
