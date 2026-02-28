from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import SourceFile, User
from app.models.enums import SourceFileType
from app.schemas.imports import (
    DetectSchemaResponse,
    MapColumnsRequest,
    MapColumnsResponse,
    MappingTemplateResponse,
    SaveTemplateRequest,
    SourceFileResponse,
    TransformRequest,
    ValidateResponse,
)
from app.services.audit_service import log_event
from app.services.file_parsers import detect_container
from app.services.import_service import (
    ImportValidationError,
    detect_schema_for_source,
    map_columns_for_source,
    persist_mapping_template,
    validate_and_persist_source,
)
from app.services.storage import storage_service
from app.utils.access import require_run_access

router = APIRouter()


@router.post("/runs/{run_id}/source-files", response_model=SourceFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_source_file(
    run_id: str,
    source_type: SourceFileType = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceFileResponse:
    run = require_run_access(db, run_id=run_id, user=current_user)

    contents = await file.read()
    if len(contents) > get_settings().max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 25MB limit")

    try:
        container = detect_container(file.filename or "")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    key = f"uploads/{run_id}/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{file.filename}"
    storage_key, checksum = storage_service.save_bytes(contents, key=key)

    source_file = SourceFile(
        run_id=run.id,
        source_type=source_type,
        original_name=file.filename or "upload",
        container_type=container,
        storage_key=storage_key,
        sha256_hash=checksum,
        uploader_id=current_user.id,
    )
    db.add(source_file)
    log_event(
        db,
        actor=current_user,
        event_type="source_file.uploaded",
        run_id=run.id,
        client_id=run.client_id,
        details={"source_type": source_type.value, "file_name": source_file.original_name, "sha256": checksum},
    )
    db.commit()
    db.refresh(source_file)
    return SourceFileResponse.model_validate(source_file)


@router.post("/source-files/{source_file_id}/detect-schema", response_model=DetectSchemaResponse)
def detect_schema(
    source_file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DetectSchemaResponse:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")
    require_run_access(db, run_id=source_file.run_id, user=current_user)

    schema_type, confidence, reasons, _ = detect_schema_for_source(source_file)
    source_file.schema_type = schema_type
    source_file.schema_confidence = confidence

    log_event(
        db,
        actor=current_user,
        event_type="source_file.schema_detected",
        run_id=source_file.run_id,
        details={"source_file_id": source_file.id, "schema": schema_type.value if schema_type else None, "confidence": confidence},
    )
    db.commit()

    requires_confirmation = 0.70 <= confidence < 0.90
    blocked = confidence < 0.70 or schema_type is None
    return DetectSchemaResponse(
        schema_type=schema_type,
        confidence=confidence,
        reasons=reasons,
        requires_confirmation=requires_confirmation,
        blocked=blocked,
    )


@router.post("/source-files/{source_file_id}/map-columns", response_model=MapColumnsResponse)
def map_columns(
    source_file_id: str,
    payload: MapColumnsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MapColumnsResponse:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")
    require_run_access(db, run_id=source_file.run_id, user=current_user)

    schema_type, _, _, parsed = detect_schema_for_source(source_file)
    if payload.schema_type is not None:
        source_file.schema_type = payload.schema_type
    elif schema_type is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to detect schema; choose schema manually")
    elif source_file.schema_type is None:
        source_file.schema_type = schema_type

    schema, mapping, confidence, required_fields, blocked = map_columns_for_source(
        source_file,
        parsed,
        payload.mapping,
    )
    source_file.schema_type = schema
    source_file.mapping_json = mapping
    source_file.mapping_confidence = confidence

    if any(not value for value in required_fields.values()):
        blocked = True

    if confidence < 0.90:
        blocked = True

    log_event(
        db,
        actor=current_user,
        event_type="source_file.columns_mapped",
        run_id=source_file.run_id,
        details={
            "source_file_id": source_file.id,
            "schema": schema.value,
            "confidence": confidence,
            "blocked": blocked,
        },
    )
    db.commit()

    return MapColumnsResponse(
        schema_type=schema,
        confidence=confidence,
        required_fields=required_fields,
        mapping=mapping,
        blocked=blocked,
    )


@router.post("/source-files/{source_file_id}/apply-transformations", response_model=SourceFileResponse)
def apply_transformations(
    source_file_id: str,
    payload: TransformRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceFileResponse:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")
    require_run_access(db, run_id=source_file.run_id, user=current_user)

    source_file.transformations_json = payload.transformations
    log_event(
        db,
        actor=current_user,
        event_type="source_file.transformations_applied",
        run_id=source_file.run_id,
        details={"source_file_id": source_file.id, "transform_keys": sorted(payload.transformations.keys())},
    )
    db.commit()
    db.refresh(source_file)
    return SourceFileResponse.model_validate(source_file)


@router.post("/source-files/{source_file_id}/validate", response_model=ValidateResponse)
def validate_source_file(
    source_file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ValidateResponse:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")
    require_run_access(db, run_id=source_file.run_id, user=current_user)

    try:
        result = validate_and_persist_source(db, source_file)
    except ImportValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    source_file.validation_json = result
    log_event(
        db,
        actor=current_user,
        event_type="source_file.validated",
        run_id=source_file.run_id,
        details={"source_file_id": source_file.id, **result},
    )
    db.commit()

    return ValidateResponse(**result)


@router.post("/source-files/{source_file_id}/save-template", response_model=MappingTemplateResponse)
def save_mapping_template(
    source_file_id: str,
    payload: SaveTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MappingTemplateResponse:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")

    run = require_run_access(db, run_id=source_file.run_id, user=current_user)
    if run.client_id != payload.client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template client_id must match run client")

    _, _, _, parsed = detect_schema_for_source(source_file)
    template = persist_mapping_template(
        db,
        source_file=source_file,
        client_id=payload.client_id,
        name=payload.name,
        scope=payload.scope,
        parsed_headers=parsed.headers,
    )

    log_event(
        db,
        actor=current_user,
        event_type="mapping_template.saved",
        run_id=source_file.run_id,
        client_id=run.client_id,
        details={"template_id": template.id, "source_file_id": source_file.id},
    )
    db.commit()
    db.refresh(template)
    return MappingTemplateResponse.model_validate(template)
