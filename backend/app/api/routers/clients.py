from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Client, FirmMembership, User
from app.schemas.client import ClientCreateRequest, ClientResponse
from app.services.audit_service import log_event

router = APIRouter()


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientResponse:
    membership = (
        db.query(FirmMembership)
        .filter(FirmMembership.firm_id == payload.firm_id, FirmMembership.user_id == current_user.id)
        .one_or_none()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not part of this firm")

    client = Client(
        firm_id=payload.firm_id,
        name=payload.name.strip(),
        country_pack=payload.country_pack,
        base_currency=payload.base_currency.upper(),
    )
    db.add(client)
    log_event(
        db,
        actor=current_user,
        event_type="client.created",
        firm_id=payload.firm_id,
        client_id=client.id,
        details={"name": client.name, "country_pack": client.country_pack.value},
    )
    db.commit()
    db.refresh(client)
    return ClientResponse.model_validate(client)


@router.get("", response_model=list[ClientResponse])
def list_clients(
    firm_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ClientResponse]:
    membership = (
        db.query(FirmMembership)
        .filter(FirmMembership.firm_id == firm_id, FirmMembership.user_id == current_user.id)
        .one_or_none()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not part of this firm")

    clients = db.query(Client).filter(Client.firm_id == firm_id).order_by(Client.created_at.desc()).all()
    return [ClientResponse.model_validate(client) for client in clients]
