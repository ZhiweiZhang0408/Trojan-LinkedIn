"""Connections: the alumni directory, connection and coffee chat invitations, and messages.

Rules (from Rie's reference implementation, contributions/rie-connections-profiles):
- Students invite alumni; one active (pending or accepted) invitation per pair.
- Only the invited alum accepts or declines; the student can withdraw a pending invitation;
  either side can remove an accepted connection. History stays readable.
- Messages open after acceptance. The sender always comes from the token.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Role, User
from ..models_connections import (
    ACTIVE_STATUSES,
    Connection,
    ConnectionMessage,
    ConnectionPurpose,
    ConnectionStatus,
)
from ..schemas import UserPublic
from ..security import get_current_user, get_current_user_optional, require_alumni, require_student
from .persona import PersonaOut, persona_out, profile_of

router = APIRouter(prefix="/connections", tags=["connections"])


# ---------- Shapes ----------

class ConnectionMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    body: str
    created_at: datetime


class ConnectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student: UserPublic
    alumni: UserPublic
    purpose: ConnectionPurpose
    note: str
    topic: str | None
    availability: str | None
    status: ConnectionStatus
    created_at: datetime
    updated_at: datetime
    messages: list[ConnectionMessageOut]
    # Shared with both participants only once the invitation is accepted
    student_email: str | None = None
    alumni_email: str | None = None


class ConnectionCreate(BaseModel):
    """Accepts the frontend's body (alumniId, purpose, note, topic, availability)."""

    model_config = ConfigDict(extra="ignore")

    alumni_id: int = Field(validation_alias=AliasChoices("alumni_id", "alumniId"))
    purpose: ConnectionPurpose = ConnectionPurpose.connection
    note: str = Field(min_length=1, max_length=2000)
    topic: str | None = Field(default=None, max_length=300)
    availability: str | None = Field(default=None, max_length=1000)


class DecisionBody(BaseModel):
    status: Literal["accepted", "declined"]
    reply: str | None = Field(default=None, max_length=4000)


class ActionBody(BaseModel):
    action: Literal["withdraw", "remove"]


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


# ---------- Helpers ----------

def _get_mine(db: Session, connection_id: int, user: User) -> Connection:
    c = db.get(Connection, connection_id)
    if not c or user.id not in (c.student_id, c.alumni_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    return c


def _view(c: Connection) -> ConnectionOut:
    out = ConnectionOut.model_validate(c)
    if c.status == ConnectionStatus.accepted:
        out.student_email, out.alumni_email = c.student.email, c.alumni.email
    return out


def _out(db: Session, c: Connection) -> ConnectionOut:
    db.refresh(c)
    return _view(c)


# ---------- Directory ----------

@router.get("/alumni", response_model=list[PersonaOut])
def alumni_directory(
    q: str | None = Query(default=None, max_length=100),
    company: str | None = Query(default=None, max_length=120),
    coffee_chats: bool | None = None,
    viewer: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Discoverable alumni, optionally filtered by text, company and coffee chat availability."""
    people = []
    for user in db.scalars(select(User).where(User.role == Role.alumni).order_by(User.full_name)):
        if viewer and user.id == viewer.id:
            continue
        p = persona_out(db, user, viewer)
        if not p.discoverable:
            continue
        if company and (p.company or "").lower() != company.lower():
            continue
        if coffee_chats is not None and p.coffee_chats != coffee_chats:
            continue
        if q:
            text = " ".join([p.full_name, p.title or "", p.company or "", p.major or "", p.bio or "", *p.skills])
            if q.lower() not in text.lower():
                continue
        people.append(p)
    return people


# ---------- Invitations ----------

@router.get("/requests", response_model=list[ConnectionOut])
def my_invitations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Connection)
        .where(or_(Connection.student_id == user.id, Connection.alumni_id == user.id))
        .order_by(Connection.updated_at.desc(), Connection.id.desc())
    )
    return [_view(c) for c in rows]


@router.post("/requests", response_model=ConnectionOut, status_code=status.HTTP_201_CREATED)
def invite(body: ConnectionCreate, user: User = Depends(require_student), db: Session = Depends(get_db)):
    alum = db.get(User, body.alumni_id)
    if not alum or alum.role != Role.alumni:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alum not found")
    p = profile_of(db, alum)
    open_to_connect = p.open_to_connect if p else True
    coffee_chats = p.coffee_chats if p else False
    if body.purpose == ConnectionPurpose.connection and not open_to_connect:
        raise HTTPException(status.HTTP_409_CONFLICT, "This alum isn't taking connection invitations")
    if body.purpose == ConnectionPurpose.coffee:
        if not coffee_chats:
            raise HTTPException(status.HTTP_409_CONFLICT, "This alum isn't taking coffee chat invitations")
        if not (body.topic and body.topic.strip()) or not (body.availability and body.availability.strip()):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add a topic and your availability")
    existing = db.scalar(
        select(Connection.id).where(
            Connection.student_id == user.id,
            Connection.alumni_id == alum.id,
            Connection.status.in_(ACTIVE_STATUSES),
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have an invitation with this alum")
    c = Connection(
        student_id=user.id,
        alumni_id=alum.id,
        purpose=body.purpose,
        note=body.note.strip(),
        topic=(body.topic or "").strip() or None,
        availability=(body.availability or "").strip() or None,
    )
    db.add(c)
    db.commit()
    return _out(db, c)


@router.patch("/requests/{connection_id}/decision", response_model=ConnectionOut)
def decide(
    connection_id: int,
    body: DecisionBody,
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
):
    c = _get_mine(db, connection_id, user)
    if c.alumni_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the invited alum can respond")
    if c.status != ConnectionStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "This invitation was already answered")
    c.status = ConnectionStatus(body.status)
    if body.reply and body.reply.strip():
        db.add(ConnectionMessage(connection_id=c.id, sender_id=user.id, body=body.reply.strip()))
    db.commit()
    return _out(db, c)


@router.patch("/requests/{connection_id}", response_model=ConnectionOut)
def change(
    connection_id: int,
    body: ActionBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = _get_mine(db, connection_id, user)
    if body.action == "withdraw":
        if c.student_id != user.id or c.status != ConnectionStatus.pending:
            raise HTTPException(status.HTTP_409_CONFLICT, "Only a pending invitation you sent can be withdrawn")
        c.status = ConnectionStatus.withdrawn
    else:
        if c.status != ConnectionStatus.accepted:
            raise HTTPException(status.HTTP_409_CONFLICT, "Only an accepted connection can be removed")
        c.status = ConnectionStatus.removed
    db.commit()
    return _out(db, c)


@router.post("/requests/{connection_id}/messages", response_model=ConnectionOut,
             status_code=status.HTTP_201_CREATED)
def send_message(
    connection_id: int,
    body: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = _get_mine(db, connection_id, user)
    if c.status != ConnectionStatus.accepted:
        raise HTTPException(status.HTTP_409_CONFLICT, "Messages open after the invitation is accepted")
    db.add(ConnectionMessage(connection_id=c.id, sender_id=user.id, body=body.body.strip()))
    db.commit()
    return _out(db, c)
