"""Connections module: alumni discovery, student discovery, connection requests and coffee chats.
Direct messaging lives in routers/messages.py (same /connections prefix)."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    CoffeeChat,
    CoffeeChatStatus,
    Connection,
    ConnectionStatus,
    User,
    UserRole,
)
from ..schemas.common import Page
from ..schemas.connections import (
    AlumniCard,
    CoffeeChatCreate,
    CoffeeChatOut,
    CoffeeChatUpdate,
    ConnectionCreate,
    ConnectionOut,
    ConnectionUpdate,
    StudentCard,
)
from ..security import get_current_user
from ..services.presenters import (
    alumni_card,
    brief,
    connection_between,
    connection_statuses,
    ensure_profile,
    student_card,
)
from ..services.recommendation import StudentCriteria, score_alumni
from ..services.taxonomy import norm, norm_skill

router = APIRouter(prefix="/connections", tags=["Connections"])


def to_local_naive(dt: datetime) -> datetime:
    """Times are stored as naive local wall-clock times (single-campus MVP)."""
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    return dt.replace(microsecond=0)


def _contains(haystack: str, needle: str) -> bool:
    return norm(needle) in norm(haystack)


# --------------------------------------------------------------------------- alumni
@router.get("/alumni", response_model=Page[AlumniCard], summary="Search the alumni directory")
def list_alumni(
    q: str | None = Query(None, description="Free text across name, company, title, industry, skills"),
    company: str | None = None,
    industry: str | None = None,
    title: str | None = Query(None, description="Job title contains"),
    skill: str | None = Query(None, description="Comma-separated skills; all must match"),
    interest: str | None = Query(None, description="Career interest contains"),
    degree: str | None = Query(None, description="USC degree contains, e.g. 'Computer Science' or 'M.S.'"),
    graduation_year: int | None = Query(None, ge=1950, le=2040),
    coffee_chat_only: bool = False,
    sort: Literal["match", "name", "graduation_year"] = "match",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[AlumniCard]:
    users = db.scalars(
        select(User).where(User.role == UserRole.alumni, User.id != viewer.id, User.discoverable.is_(True))
    ).all()
    criteria = None
    if viewer.role == UserRole.student:
        criteria = StudentCriteria.from_profile(ensure_profile(db, viewer))
    statuses = connection_statuses(db, viewer.id)
    wanted_skills = [norm_skill(s) for s in (skill or "").split(",") if s.strip()]

    cards: list[AlumniCard] = []
    for u in users:
        a = ensure_profile(db, u)
        skills_norm = {norm_skill(s) for s in (a.skills or [])}
        if company and not _contains(a.current_company or "", company):
            continue
        if industry and not _contains(a.industry or "", industry):
            continue
        if title and not _contains(a.current_title or "", title):
            continue
        if wanted_skills and not all(any(w in s for s in skills_norm) for w in wanted_skills):
            continue
        if interest and not any(_contains(i, interest) for i in (a.career_interests or [])):
            continue
        if degree and not _contains(a.usc_degree or "", degree):
            continue
        if graduation_year and a.graduation_year != graduation_year:
            continue
        if coffee_chat_only and not a.coffee_chat_available:
            continue
        if q:
            blob = " ".join([u.full_name, a.current_company, a.current_title, a.industry, a.usc_degree,
                             " ".join(a.skills or []), " ".join(a.career_interests or [])])
            if not all(_contains(blob, part) for part in q.split()):
                continue
        score = score_alumni(criteria, a).score if criteria else None
        cards.append(alumni_card(u, score, statuses.get(u.id)))

    if sort == "match" and criteria:
        cards.sort(key=lambda c: (-(c.match_score or 0), c.full_name))
    elif sort == "graduation_year":
        cards.sort(key=lambda c: (-(c.graduation_year or 0), c.full_name))
    else:
        cards.sort(key=lambda c: c.full_name)
    db.commit()
    return Page(items=cards[offset : offset + limit], total=len(cards))


# --------------------------------------------------------------------------- students
@router.get("/students", response_model=Page[StudentCard], summary="Find students with similar interests")
def list_students(
    q: str | None = None,
    interest: str | None = None,
    skill: str | None = None,
    major: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[StudentCard]:
    users = db.scalars(
        select(User).where(User.role == UserRole.student, User.id != viewer.id, User.discoverable.is_(True))
    ).all()
    me = ensure_profile(db, viewer) if viewer.role == UserRole.student else None
    statuses = connection_statuses(db, viewer.id)
    cards: list[StudentCard] = []
    for u in users:
        s = ensure_profile(db, u)
        if interest and not any(_contains(i, interest) for i in (s.career_interests or [])):
            continue
        if skill and not any(_contains(x, skill) for x in (s.skills or [])):
            continue
        if major and not _contains(s.major or "", major):
            continue
        if q:
            blob = " ".join([u.full_name, s.major or "", " ".join(s.skills or []),
                             " ".join(s.career_interests or []), " ".join(s.target_roles or [])])
            if not all(_contains(blob, part) for part in q.split()):
                continue
        cards.append(student_card(u, me, statuses.get(u.id)))
    cards.sort(key=lambda c: (-(len(c.shared_interests) * 2 + len(c.shared_skills)), c.full_name))
    db.commit()
    return Page(items=cards[:limit], total=len(cards))


# --------------------------------------------------------------------------- connection requests
def _conn_out(c: Connection, me_id: int) -> ConnectionOut:
    return ConnectionOut(
        id=c.id,
        requester=brief(c.requester),
        addressee=brief(c.addressee),
        message=c.message,
        status=c.status,
        direction="outgoing" if c.requester_id == me_id else "incoming",
        created_at=c.created_at,
    )


@router.post("/requests", response_model=ConnectionOut, status_code=201, summary="Send a connection request")
def create_connection(
    body: ConnectionCreate, me: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ConnectionOut:
    other = db.get(User, body.addressee_id)
    if other is None:
        raise HTTPException(404, "User not found")
    if other.id == me.id:
        raise HTTPException(400, "You cannot connect with yourself")
    if me.role == UserRole.alumni and other.role == UserRole.alumni:
        raise HTTPException(400, "Connections must include at least one student")
    existing = connection_between(db, me.id, other.id)
    if existing and existing.status == ConnectionStatus.accepted:
        raise HTTPException(409, f"You're already connected with {other.full_name}")
    if existing and existing.status == ConnectionStatus.pending:
        if existing.requester_id == me.id:
            raise HTTPException(409, f"You already sent {other.full_name} a request")
        raise HTTPException(409, f"{other.full_name} already sent you a request. Accept it under Connections")
    conn = Connection(requester_id=me.id, addressee_id=other.id, message=body.message.strip())
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return _conn_out(conn, me.id)


@router.get("/requests", response_model=Page[ConnectionOut], summary="List my connections and requests")
def list_connections(
    status_filter: ConnectionStatus | None = Query(None, alias="status"),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[ConnectionOut]:
    stmt = select(Connection).where(or_(Connection.requester_id == me.id, Connection.addressee_id == me.id))
    if status_filter:
        stmt = stmt.where(Connection.status == status_filter)
    rows = db.scalars(stmt.order_by(Connection.created_at.desc())).all()
    items = [_conn_out(c, me.id) for c in rows]
    return Page(items=items, total=len(items))


@router.patch(
    "/requests/{conn_id}",
    response_model=ConnectionOut,
    summary="Accept, decline or withdraw a request, or remove a connection",
)
def update_connection(
    conn_id: int, body: ConnectionUpdate, me: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ConnectionOut:
    """- `accept` / `decline`: recipient only, while pending
    - `withdraw`: requester only, while pending
    - `remove`: either person, once accepted. Messaging stays open only if the two
      still have a confirmed coffee chat; earlier messages remain readable."""
    conn = db.get(Connection, conn_id)
    if conn is None or me.id not in (conn.requester_id, conn.addressee_id):
        raise HTTPException(404, "Connection request not found")
    if body.action in ("accept", "decline", "withdraw"):
        if conn.status != ConnectionStatus.pending:
            raise HTTPException(409, f"Request is already {conn.status.value}")
        if body.action == "withdraw":
            if conn.requester_id != me.id:
                raise HTTPException(403, "Only the person who sent the request can withdraw it")
            conn.status = ConnectionStatus.withdrawn
        else:
            if conn.addressee_id != me.id:
                raise HTTPException(403, "Only the recipient can respond to this request")
            conn.status = ConnectionStatus.accepted if body.action == "accept" else ConnectionStatus.declined
    else:  # remove
        if conn.status != ConnectionStatus.accepted:
            raise HTTPException(409, "Only an accepted connection can be removed")
        conn.status = ConnectionStatus.removed
    db.commit()
    db.refresh(conn)
    return _conn_out(conn, me.id)


# --------------------------------------------------------------------------- coffee chats
def _chat_out(c: CoffeeChat, me_id: int) -> CoffeeChatOut:
    return CoffeeChatOut(
        id=c.id,
        requester=brief(c.requester),
        recipient=brief(c.recipient),
        proposed_time=c.proposed_time,
        duration_minutes=c.duration_minutes,
        message=c.message,
        response_note=c.response_note,
        status=c.status,
        direction="outgoing" if c.requester_id == me_id else "incoming",
        created_at=c.created_at,
    )


@router.post("/coffee-chats", response_model=CoffeeChatOut, status_code=201, summary="Request a coffee chat")
def create_coffee_chat(
    body: CoffeeChatCreate, me: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CoffeeChatOut:
    """Creates an in-app request only. No emails or calendar invites are sent."""
    other = db.get(User, body.recipient_id)
    if other is None:
        raise HTTPException(404, "User not found")
    if other.id == me.id:
        raise HTTPException(400, "You cannot request a coffee chat with yourself")
    if me.role == UserRole.alumni and other.role == UserRole.alumni:
        raise HTTPException(400, "Coffee chats must include at least one student")
    if other.role == UserRole.alumni:
        ap = ensure_profile(db, other)
        if ap.coffee_chat_available is False:
            raise HTTPException(409, f"{other.full_name} is not accepting coffee chats right now")
    when = to_local_naive(body.proposed_time)
    if when < datetime.now() - timedelta(minutes=5):
        raise HTTPException(422, "Proposed time must be in the future")
    if when > datetime.now() + timedelta(days=365):
        raise HTTPException(422, "Proposed time must be within the next 12 months")
    duplicate = db.scalar(
        select(CoffeeChat).where(
            CoffeeChat.requester_id == me.id,
            CoffeeChat.recipient_id == other.id,
            CoffeeChat.status == CoffeeChatStatus.pending,
        )
    )
    if duplicate:
        raise HTTPException(409, "You already have a pending request with this person")
    chat = CoffeeChat(
        requester_id=me.id,
        recipient_id=other.id,
        proposed_time=when,
        duration_minutes=body.duration_minutes,
        message=body.message.strip(),
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return _chat_out(chat, me.id)


@router.get("/coffee-chats", response_model=Page[CoffeeChatOut], summary="List my coffee chats")
def list_coffee_chats(
    status_filter: CoffeeChatStatus | None = Query(None, alias="status"),
    direction: Literal["incoming", "outgoing"] | None = None,
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[CoffeeChatOut]:
    stmt = select(CoffeeChat).where(or_(CoffeeChat.requester_id == me.id, CoffeeChat.recipient_id == me.id))
    if status_filter:
        stmt = stmt.where(CoffeeChat.status == status_filter)
    if direction == "incoming":
        stmt = stmt.where(CoffeeChat.recipient_id == me.id)
    elif direction == "outgoing":
        stmt = stmt.where(CoffeeChat.requester_id == me.id)
    rows = db.scalars(stmt.order_by(CoffeeChat.proposed_time)).all()
    items = [_chat_out(c, me.id) for c in rows]
    return Page(items=items, total=len(items))


@router.patch("/coffee-chats/{chat_id}", response_model=CoffeeChatOut, summary="Accept, decline or cancel")
def update_coffee_chat(
    chat_id: int, body: CoffeeChatUpdate, me: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CoffeeChatOut:
    """Rules: the recipient accepts/declines a pending request; the requester can cancel a
    pending request; either participant can cancel an accepted chat."""
    chat = db.get(CoffeeChat, chat_id)
    if chat is None or me.id not in (chat.requester_id, chat.recipient_id):
        raise HTTPException(404, "Coffee chat not found")
    if body.action in ("accept", "decline"):
        if me.id != chat.recipient_id:
            raise HTTPException(403, "Only the recipient can accept or decline")
        if chat.status != CoffeeChatStatus.pending:
            raise HTTPException(409, f"Request is already {chat.status.value}")
        chat.status = CoffeeChatStatus.accepted if body.action == "accept" else CoffeeChatStatus.declined
    else:  # cancel
        if chat.status == CoffeeChatStatus.pending and me.id != chat.requester_id:
            raise HTTPException(403, "Only the requester can cancel a pending request; decline it instead")
        if chat.status not in (CoffeeChatStatus.pending, CoffeeChatStatus.accepted):
            raise HTTPException(409, f"Request is already {chat.status.value}")
        chat.status = CoffeeChatStatus.cancelled
    chat.response_note = body.note.strip()
    db.commit()
    db.refresh(chat)
    return _chat_out(chat, me.id)
