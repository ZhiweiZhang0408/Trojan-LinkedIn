"""Profiles for the persona module: the fields a user edits beyond the team `users` table.

company, title, major, grad_year and linkedin_url stay on `User` (single source); this table
holds the rest. Ported from Rie's Connections & Profiles reference implementation
(contributions/rie-connections-profiles), merged into one `profiles` table as her
integration guide proposes.
"""
from sqlalchemy import JSON, Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .models import User


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    bio: Mapped[str | None] = mapped_column(Text, default=None)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    experience: Mapped[str | None] = mapped_column(Text, default=None)
    education: Mapped[str | None] = mapped_column(Text, default=None)
    projects: Mapped[str | None] = mapped_column(Text, default=None)
    location: Mapped[str | None] = mapped_column(String(120), default=None)
    # Alumni availability: accepting connection invitations / coffee chat invitations
    open_to_connect: Mapped[bool] = mapped_column(Boolean, default=True)
    coffee_chats: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduling_url: Mapped[str | None] = mapped_column(String(300), default=None)
    # Privacy: appear in the alumni directory
    discoverable: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[User] = relationship()
