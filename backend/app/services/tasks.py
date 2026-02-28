from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Run, User
from app.services.export_service import generate_export_pack


def export_pack_task(db: Session, run_id: str, actor_id: str | None = None) -> str:
    run = db.get(Run, run_id)
    if run is None:
        raise ValueError(f'Run not found: {run_id}')

    actor = None
    if actor_id:
        actor = db.query(User).filter(User.id == actor_id).one_or_none()

    pack = generate_export_pack(db, run=run, actor=actor)
    db.commit()
    return pack.id
