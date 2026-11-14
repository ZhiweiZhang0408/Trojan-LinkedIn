"""Database models for the persona module (owner: persona teammate).

Prefer a separate Profile table (one-to-one with users) over adding columns to User,
so this module doesn't conflict with app/models.py. Example:

    from sqlalchemy import ForeignKey, Text
    from sqlalchemy.orm import Mapped, mapped_column, relationship

    class Profile(Base):
        __tablename__ = "profiles"

        id: Mapped[int] = mapped_column(primary_key=True)
        user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
        bio: Mapped[str | None] = mapped_column(Text, default=None)
        skills: Mapped[str | None] = mapped_column(Text, default=None)

        user: Mapped[User] = relationship()
"""
from .database import Base  # noqa: F401
from .models import User  # noqa: F401
