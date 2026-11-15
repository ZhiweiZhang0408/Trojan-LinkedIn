"""Helpers that turn ORM objects into response schemas and answer relationship questions."""
from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..models import (
    AlumniProfile,
    CoffeeChat,
    CoffeeChatStatus,
    Connection,
    ConnectionStatus,
    StudentProfile,
    User,
    UserRole,
)
from ..schemas.connections import AlumniCard, StudentCard, UserBrief


def ensure_profile(db: Session, user: User) -> StudentProfile | AlumniProfile:
    """Every user has exactly one role-specific profile row (created lazily)."""
    if user.role == UserRole.student:
        if user.student_profile is None:
            user.student_profile = StudentProfile()
            db.flush()
        return user.student_profile
    if user.alumni_profile is None:
        user.alumni_profile = AlumniProfile()
        db.flush()
    return user.alumni_profile


def headline(user: User) -> str:
    if user.role == UserRole.alumni and user.alumni_profile:
        a = user.alumni_profile
        if a.current_title and a.current_company:
            return f"{a.current_title} at {a.current_company}"
        return a.current_title or a.current_company or "USC alum"
    if user.student_profile:
        s = user.student_profile
        bits = [s.major or "USC student"]
        if s.graduation_year:
            bits.append(f"Class of {s.graduation_year}")
        return ", ".join(bits)
    return "USC alum" if user.role == UserRole.alumni else "USC student"


def brief(user: User) -> UserBrief:
    return UserBrief(id=user.id, full_name=user.full_name, role=user.role, headline=headline(user))


def connection_between(db: Session, a_id: int, b_id: int) -> Connection | None:
    return db.scalars(
        select(Connection)
        .where(
            or_(
                and_(Connection.requester_id == a_id, Connection.addressee_id == b_id),
                and_(Connection.requester_id == b_id, Connection.addressee_id == a_id),
            )
        )
        .order_by(Connection.id.desc())
    ).first()


def active_connection(db: Session, a_id: int, b_id: int) -> Connection | None:
    """The latest connection between two users if it is pending or accepted."""
    conn = connection_between(db, a_id, b_id)
    if conn and conn.status in (ConnectionStatus.pending, ConnectionStatus.accepted):
        return conn
    return None


def connection_statuses(db: Session, me_id: int) -> dict[int, str]:
    """Map other_user_id -> 'connected' | 'pending_outgoing' | 'pending_incoming' (latest wins)."""
    rows = db.scalars(
        select(Connection)
        .where(or_(Connection.requester_id == me_id, Connection.addressee_id == me_id))
        .order_by(Connection.id)
    ).all()
    out: dict[int, str] = {}
    for c in rows:
        other = c.addressee_id if c.requester_id == me_id else c.requester_id
        if c.status == ConnectionStatus.accepted:
            out[other] = "connected"
        elif c.status == ConnectionStatus.pending:
            out[other] = "pending_outgoing" if c.requester_id == me_id else "pending_incoming"
        else:
            out.pop(other, None)
    return out


def has_confirmed_chat(db: Session, a_id: int, b_id: int) -> bool:
    chat = db.scalars(
        select(CoffeeChat).where(
            CoffeeChat.status == CoffeeChatStatus.accepted,
            or_(
                and_(CoffeeChat.requester_id == a_id, CoffeeChat.recipient_id == b_id),
                and_(CoffeeChat.requester_id == b_id, CoffeeChat.recipient_id == a_id),
            ),
        )
    ).first()
    return chat is not None


def is_connected(db: Session, a_id: int, b_id: int) -> bool:
    conn = connection_between(db, a_id, b_id)
    return bool(conn and conn.status == ConnectionStatus.accepted)


def trusted_pair(db: Session, a_id: int, b_id: int) -> bool:
    """Accepted connection or confirmed coffee chat: unlocks email, messages and 'connections' resumes."""
    return is_connected(db, a_id, b_id) or has_confirmed_chat(db, a_id, b_id)


def can_see_email(db: Session, viewer: User, target: User) -> bool:
    if viewer.id == target.id:
        return True
    return bool(target.show_email_to_connections) and trusted_pair(db, viewer.id, target.id)


def messaging_status(db: Session, me: User, other: User) -> tuple[bool, str | None]:
    """Direct messages are allowed between students and alumni (or two students) once they
    are connected or have a confirmed coffee chat. Cold outreach goes through requests."""
    if me.id == other.id:
        return False, "You cannot message yourself"
    if me.role == UserRole.alumni and other.role == UserRole.alumni:
        return False, "Messaging is available between students and alumni, or between students"
    if not trusted_pair(db, me.id, other.id):
        return False, "Connect or confirm a coffee chat with this person to start messaging"
    return True, None


def can_view_resume(db: Session, viewer: User, target: User) -> bool:
    sp = target.student_profile
    if sp is None or not sp.resume_stored_name:
        return False
    if viewer.id == target.id:
        return True
    visibility = sp.resume_visibility or "connections"
    if visibility == "everyone":
        return True
    if visibility == "connections":
        return trusted_pair(db, viewer.id, target.id)
    return False


def alumni_card(user: User, score: int | None = None, status: str | None = None) -> AlumniCard:
    a = user.alumni_profile or AlumniProfile()
    return AlumniCard(
        user_id=user.id,
        full_name=user.full_name,
        current_title=a.current_title or "",
        current_company=a.current_company or "",
        industry=a.industry or "",
        usc_degree=a.usc_degree or "",
        graduation_year=a.graduation_year,
        skills=list(a.skills or []),
        career_interests=list(a.career_interests or []),
        bio=(a.bio or "")[:220],
        coffee_chat_available=bool(a.coffee_chat_available if a.coffee_chat_available is not None else True),
        match_score=score,
        connection_status=status,
    )


def student_card(user: User, me: StudentProfile | None = None, status: str | None = None) -> StudentCard:
    s = user.student_profile or StudentProfile()
    shared_interests: list[str] = []
    shared_skills: list[str] = []
    if me is not None:
        mine_i = {x.lower() for x in (me.career_interests or [])}
        mine_s = {x.lower() for x in (me.skills or [])}
        shared_interests = [x for x in (s.career_interests or []) if x.lower() in mine_i]
        shared_skills = [x for x in (s.skills or []) if x.lower() in mine_s]
    return StudentCard(
        user_id=user.id,
        full_name=user.full_name,
        major=s.major or "",
        degree_program=s.degree_program or "",
        graduation_year=s.graduation_year,
        skills=list(s.skills or []),
        career_interests=list(s.career_interests or []),
        target_roles=list(s.target_roles or []),
        shared_interests=shared_interests,
        shared_skills=shared_skills,
        connection_status=status,
    )
