from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import CountryPack


class ClientCreateRequest(BaseModel):
    firm_id: str
    name: str
    country_pack: CountryPack
    base_currency: str


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    firm_id: str
    name: str
    country_pack: CountryPack
    base_currency: str
    created_at: datetime
