from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent, User


def log_event(
    db: Session,
    *,
    actor: User | None,
    event_type: str,
    details: dict[str, Any] | None = None,
    firm_id: str | None = None,
    client_id: str | None = None,
    run_id: str | None = None,
) -> None:
    event = AuditEvent(
        firm_id=firm_id,
        client_id=client_id,
        run_id=run_id,
        actor_user_id=actor.id if actor else None,
        event_type=event_type,
        details=details or {},
    )
    db.add(event)
