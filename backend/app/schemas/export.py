from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ExportPackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    storage_key: str
    checksum: str
    format: str
    reproducibility_fingerprint: str
    created_at: datetime


class ExportPackDownloadResponse(BaseModel):
    id: str
    run_id: str
    download_url: str
    checksum: str
