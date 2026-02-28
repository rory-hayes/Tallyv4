from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Client, FirmMembership, Run, User


def require_client_access(db: Session, *, client_id: str, user: User) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    membership = (
        db.query(FirmMembership)
        .filter(FirmMembership.firm_id == client.firm_id, FirmMembership.user_id == user.id)
        .one_or_none()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to client")

    return client


def require_run_access(db: Session, *, run_id: str, user: User) -> Run:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    require_client_access(db, client_id=run.client_id, user=user)
    return run
