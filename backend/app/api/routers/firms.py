from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Firm, FirmMembership, User
from app.models.enums import FirmRole
from app.schemas.firm import FirmCreateRequest, FirmResponse, FirmUserCreateRequest, MembershipResponse
from app.services.audit_service import log_event

router = APIRouter()


@router.post("", response_model=FirmResponse, status_code=status.HTTP_201_CREATED)
def create_firm(
    payload: FirmCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FirmResponse:
    firm = Firm(name=payload.name.strip())
    db.add(firm)
    db.flush()

    db.add(FirmMembership(firm_id=firm.id, user_id=current_user.id, role=FirmRole.ADMIN))
    log_event(db, actor=current_user, event_type="firm.created", firm_id=firm.id, details={"name": firm.name})

    db.commit()
    db.refresh(firm)
    return FirmResponse.model_validate(firm)


@router.post("/{firm_id}/users", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED)
def add_user_to_firm(
    firm_id: str,
    payload: FirmUserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MembershipResponse:
    membership = (
        db.query(FirmMembership)
        .filter(FirmMembership.firm_id == firm_id, FirmMembership.user_id == current_user.id)
        .one_or_none()
    )
    if membership is None or membership.role != FirmRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required")

    firm = db.get(Firm, firm_id)
    if firm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Firm not found")

    user = db.query(User).filter(User.email == payload.email.lower()).one_or_none()
    if user is None:
        user = User(email=payload.email.lower(), full_name=payload.full_name)
        db.add(user)
        db.flush()

    existing = (
        db.query(FirmMembership)
        .filter(FirmMembership.firm_id == firm_id, FirmMembership.user_id == user.id)
        .one_or_none()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already belongs to firm")

    new_membership = FirmMembership(firm_id=firm_id, user_id=user.id, role=payload.role)
    db.add(new_membership)
    log_event(
        db,
        actor=current_user,
        event_type="firm.user_added",
        firm_id=firm_id,
        details={"user_id": user.id, "role": payload.role.value},
    )
    db.commit()
    db.refresh(new_membership)
    return MembershipResponse(
        id=new_membership.id,
        firm_id=new_membership.firm_id,
        user_id=new_membership.user_id,
        role=new_membership.role,
    )
