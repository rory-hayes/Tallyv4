from __future__ import annotations

from datetime import datetime, timedelta, timezone

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.config import get_settings


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(secret_key=settings.magic_link_secret, salt="tally-auth")


def create_magic_link_token(email: str) -> tuple[str, datetime]:
    settings = get_settings()
    token = _serializer().dumps({"email": email, "kind": "magic-link"})
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.magic_link_ttl_minutes)
    return token, expires_at


def verify_magic_link_token(token: str) -> str:
    settings = get_settings()
    try:
        payload = _serializer().loads(token, max_age=settings.magic_link_ttl_minutes * 60)
    except SignatureExpired as exc:
        raise ValueError("Magic link token expired") from exc
    except BadSignature as exc:
        raise ValueError("Invalid magic link token") from exc

    if payload.get("kind") != "magic-link" or "email" not in payload:
        raise ValueError("Invalid magic link token payload")
    return str(payload["email"])


def create_access_token(user_id: str, email: str) -> tuple[str, datetime]:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_ttl_minutes)
    token = _serializer().dumps(
        {
            "kind": "access-token",
            "user_id": user_id,
            "email": email,
            "exp": int(expires_at.timestamp()),
        }
    )
    return token, expires_at


def verify_access_token(token: str) -> tuple[str, str]:
    settings = get_settings()
    try:
        payload = _serializer().loads(token, max_age=settings.access_token_ttl_minutes * 60)
    except SignatureExpired as exc:
        raise ValueError("Access token expired") from exc
    except BadSignature as exc:
        raise ValueError("Invalid access token") from exc

    if payload.get("kind") != "access-token":
        raise ValueError("Invalid access token payload")

    user_id = payload.get("user_id")
    email = payload.get("email")
    if not user_id or not email:
        raise ValueError("Invalid access token subject")

    return str(user_id), str(email)
