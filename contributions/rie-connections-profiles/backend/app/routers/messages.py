"""Direct messages between students and alumni (and between students).

Messaging unlocks once two people have an accepted connection or a confirmed coffee chat.
Messages stay inside TrojanLink; nothing is emailed or forwarded.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Message, User
from ..models.user import utcnow
from ..schemas.connections import Conversation, Inbox, MessageCreate, MessageOut, ThreadOut
from ..security import get_current_user
from ..services.presenters import brief, messaging_status

router = APIRouter(prefix="/connections/messages", tags=["Messages"])


def _out(m: Message, me_id: int) -> MessageOut:
    return MessageOut(
        id=m.id,
        sender_id=m.sender_id,
        recipient_id=m.recipient_id,
        body=m.body,
        created_at=m.created_at,
        read_at=m.read_at,
        is_mine=m.sender_id == me_id,
    )


def _pair(me_id: int, other_id: int):
    return or_(
        and_(Message.sender_id == me_id, Message.recipient_id == other_id),
        and_(Message.sender_id == other_id, Message.recipient_id == me_id),
    )


def _other(db: Session, user_id: int) -> User:
    other = db.get(User, user_id)
    if other is None:
        raise HTTPException(404, "User not found")
    return other


@router.get("", response_model=Inbox, summary="Inbox: one thread per person, newest first")
def inbox(me: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Inbox:
    rows = db.scalars(
        select(Message)
        .where(or_(Message.sender_id == me.id, Message.recipient_id == me.id))
        .order_by(Message.created_at.desc(), Message.id.desc())
    ).all()
    latest: dict[int, Message] = {}
    unread: dict[int, int] = {}
    for m in rows:
        other_id = m.recipient_id if m.sender_id == me.id else m.sender_id
        latest.setdefault(other_id, m)
        if m.recipient_id == me.id and m.read_at is None:
            unread[other_id] = unread.get(other_id, 0) + 1
    threads: list[ThreadOut] = []
    for other_id, m in latest.items():
        other = db.get(User, other_id)
        if other is None:
            continue
        allowed, _ = messaging_status(db, me, other)
        threads.append(
            ThreadOut(other=brief(other), last_message=_out(m, me.id), unread_count=unread.get(other_id, 0), can_message=allowed)
        )
    return Inbox(items=threads, total=len(threads), total_unread=sum(unread.values()))


@router.get("/unread-count", summary="Number of unread messages (for a nav badge)")
def unread_count(me: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    n = db.scalar(select(func.count()).where(Message.recipient_id == me.id, Message.read_at.is_(None)))
    return {"unread": n or 0}


@router.get("/{user_id}", response_model=Conversation, summary="Conversation with one person (marks it read)")
def conversation(
    user_id: int,
    limit: int = Query(200, ge=1, le=500),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Conversation:
    other = _other(db, user_id)
    allowed, reason = messaging_status(db, me, other)
    rows = db.scalars(
        select(Message).where(_pair(me.id, other.id)).order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)
    ).all()
    db.execute(
        update(Message)
        .where(Message.sender_id == other.id, Message.recipient_id == me.id, Message.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()
    items = [_out(m, me.id) for m in reversed(rows)]
    return Conversation(other=brief(other), can_message=allowed, reason=reason, items=items, total=len(items))


@router.post("/{user_id}", response_model=MessageOut, status_code=201, summary="Send a message")
def send_message(
    user_id: int, body: MessageCreate, me: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> MessageOut:
    other = _other(db, user_id)
    allowed, reason = messaging_status(db, me, other)
    if not allowed:
        raise HTTPException(403, reason)
    text = body.body.strip()
    if not text:
        raise HTTPException(422, "Message cannot be empty")
    m = Message(sender_id=me.id, recipient_id=other.id, body=text)
    db.add(m)
    db.commit()
    db.refresh(m)
    return _out(m, me.id)
