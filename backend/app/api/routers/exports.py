from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import ExportPack, User
from app.schemas.export import ExportPackDownloadResponse, ExportPackResponse
from app.services.audit_service import log_event
from app.services.export_service import generate_export_pack
from app.services.storage import storage_service
from app.utils.access import require_run_access

router = APIRouter()


@router.post("/runs/{run_id}/export-pack", response_model=ExportPackResponse, status_code=status.HTTP_201_CREATED)
def create_export_pack(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportPackResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)
    pack = generate_export_pack(db, run, current_user)
    log_event(
        db,
        actor=current_user,
        event_type="export_pack.created",
        run_id=run.id,
        client_id=run.client_id,
        details={"pack_id": pack.id, "checksum": pack.checksum},
    )
    db.commit()
    db.refresh(pack)
    return ExportPackResponse.model_validate(pack)


@router.get("/runs/{run_id}/export-pack/{pack_id}", response_model=ExportPackDownloadResponse)
def get_export_pack(
    run_id: str,
    pack_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportPackDownloadResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)
    pack = db.get(ExportPack, pack_id)
    if pack is None or pack.run_id != run.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export pack not found")

    return ExportPackDownloadResponse(
        id=pack.id,
        run_id=run.id,
        download_url=storage_service.get_download_url(pack.storage_key),
        checksum=pack.checksum,
    )
