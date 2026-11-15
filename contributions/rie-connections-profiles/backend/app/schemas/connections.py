from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from ..models import CoffeeChatStatus, ConnectionStatus, UserRole


class UserBrief(BaseModel):
    id: int
    full_name: str
    role: UserRole
    headline: str


class AlumniCard(BaseModel):
    user_id: int
    full_name: str
    current_title: str
    current_company: str
    industry: str
    usc_degree: str
    graduation_year: int | None
    skills: list[str]
    career_interests: list[str]
    bio: str = Field(default="", description="Short biography (truncated)")
    coffee_chat_available: bool
    match_score: int | None = Field(
        default=None, description="Heuristic relevance score 0-100 for the current student (not a probability)"
    )
    connection_status: str | None = None


class StudentCard(BaseModel):
    user_id: int
    full_name: str
    major: str
    degree_program: str
    graduation_year: int | None
    skills: list[str]
    career_interests: list[str]
    target_roles: list[str]
    shared_interests: list[str] = []
    shared_skills: list[str] = []
    connection_status: str | None = None


# ---- connection requests -------------------------------------------------
class ConnectionCreate(BaseModel):
    addressee_id: int
    message: str = Field(default="", max_length=1000)


class ConnectionUpdate(BaseModel):
    """accept / decline: the recipient, while pending. withdraw: the requester, while pending.
    remove: either person, once accepted."""

    action: Literal["accept", "decline", "withdraw", "remove"]


class ConnectionOut(BaseModel):
    id: int
    requester: UserBrief
    addressee: UserBrief
    message: str
    status: ConnectionStatus
    direction: Literal["incoming", "outgoing"]
    created_at: datetime


# ---- coffee chats --------------------------------------------------------
class CoffeeChatCreate(BaseModel):
    recipient_id: int
    proposed_time: datetime = Field(description="Proposed start time (ISO 8601, local time)")
    duration_minutes: int = Field(default=30, ge=15, le=120)
    message: str = Field(default="", max_length=2000)


class CoffeeChatUpdate(BaseModel):
    action: Literal["accept", "decline", "cancel"]
    note: str = Field(default="", max_length=500)


class CoffeeChatOut(BaseModel):
    id: int
    requester: UserBrief
    recipient: UserBrief
    proposed_time: datetime
    duration_minutes: int
    message: str
    response_note: str
    status: CoffeeChatStatus
    direction: Literal["incoming", "outgoing"]
    created_at: datetime


# ---- messages -----------------------------------------------------------
class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    body: str
    created_at: datetime
    read_at: datetime | None
    is_mine: bool


class ThreadOut(BaseModel):
    """One conversation in the inbox, keyed by the other participant."""

    other: UserBrief
    last_message: MessageOut | None
    unread_count: int
    can_message: bool


class Inbox(BaseModel):
    items: list[ThreadOut]
    total: int
    total_unread: int


class Conversation(BaseModel):
    other: UserBrief
    can_message: bool
    reason: str | None = Field(default=None, description="Why messaging is unavailable, if it is")
    items: list[MessageOut]
    total: int
