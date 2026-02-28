from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import MappingScope, SchemaType, SourceFileType


class SourceFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    source_type: SourceFileType
    original_name: str
    container_type: str
    sha256_hash: str
    upload_timestamp: datetime


class DetectSchemaResponse(BaseModel):
    schema_type: SchemaType | None
    confidence: float
    reasons: list[str]
    requires_confirmation: bool
    blocked: bool


class MapColumnsRequest(BaseModel):
    mapping: dict[str, Any] | None = None
    schema_type: SchemaType | None = None


class MapColumnsResponse(BaseModel):
    schema_type: SchemaType
    confidence: float
    required_fields: dict[str, bool]
    mapping: dict[str, Any]
    blocked: bool


class TransformRequest(BaseModel):
    transformations: dict[str, Any]


class ValidateResponse(BaseModel):
    row_count: int
    parsed_ok: int
    parsed_failed: int
    failure_rate: float
    blockers: list[str]
    warnings: list[str]


class SaveTemplateRequest(BaseModel):
    client_id: str
    name: str
    scope: MappingScope = MappingScope.CLIENT


class MappingTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    name: str
    scope: MappingScope
    schema_type: SchemaType
    source_type: SourceFileType
    header_fingerprint: str
    created_at: datetime
