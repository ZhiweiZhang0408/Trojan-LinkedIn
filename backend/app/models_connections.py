"""Connections module: student-to-alum invitations (career connection or coffee chat) and the
messages exchanged once an invitation is accepted.

Rules follow Rie's reference implementation (contributions/rie-connections-profiles):
one active invitation per pair, the alum decides, messaging opens after acceptance, the
sender always comes from the token. Coffee chats are an invitation `purpose`, and messages
live in `connection_messages` so they never mix with job-request `messages`.
"""
import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .models import User


class ConnectionPurpose(str, enum.Enum):
    connection = "connection"
    coffee = "coffee"


class ConnectionStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    withdrawn = "withdrawn"
    removed = "removed"


ACTIVE_STATUSES = (ConnectionStatus.pending, ConnectionStatus.accepted)


class Connection(Base):
    __tablename__ = "connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    alumni_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[ConnectionPurpose] = mapped_column(
        Enum(ConnectionPurpose, native_enum=False), default=ConnectionPurpose.connection
    )
    note: Mapped[str] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(300), default=None)
    availability: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[ConnectionStatus] = mapped_column(
        Enum(ConnectionStatus, native_enum=False), default=ConnectionStatus.pending, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    student: Mapped[User] = relationship(foreign_keys=[student_id])
    alumni: Mapped[User] = relationship(foreign_keys=[alumni_id])
    messages: Mapped[list["ConnectionMessage"]] = relationship(
        back_populates="connection", order_by="ConnectionMessage.id", cascade="all, delete-orphan"
    )


class ConnectionMessage(Base):
    __tablename__ = "connection_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    connection_id: Mapped[int] = mapped_column(ForeignKey("connections.id"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    connection: Mapped[Connection] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship()
