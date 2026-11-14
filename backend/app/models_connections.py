"""Database models for the connections module (owner: connections teammate).

Inherit from Base and reference users via ForeignKey("users.id"). Tables are created
automatically on startup and by `python -m app.seed`. Example:

    from sqlalchemy import ForeignKey, String
    from sqlalchemy.orm import Mapped, mapped_column, relationship

    class Connection(Base):
        __tablename__ = "connections"

        id: Mapped[int] = mapped_column(primary_key=True)
        requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
        addressee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
        status: Mapped[str] = mapped_column(String(20), default="pending")

        requester: Mapped[User] = relationship(foreign_keys=[requester_id])
        addressee: Mapped[User] = relationship(foreign_keys=[addressee_id])
"""
from .database import Base  # noqa: F401
from .models import User  # noqa: F401
