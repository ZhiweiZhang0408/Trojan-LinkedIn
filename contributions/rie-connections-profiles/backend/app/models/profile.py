from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .user import utcnow

if TYPE_CHECKING:
    from .user import User


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    major: Mapped[str] = mapped_column(String(120), default="")
    degree_program: Mapped[str] = mapped_column(String(120), default="")
    graduation_year: Mapped[Optional[int]] = mapped_column(default=None)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    career_interests: Mapped[list] = mapped_column(JSON, default=list)
    target_roles: Mapped[list] = mapped_column(JSON, default=list)
    experience: Mapped[str] = mapped_column(Text, default="")  # internships, projects, campus roles
    bio: Mapped[str] = mapped_column(Text, default="")
    resume_url: Mapped[str] = mapped_column(String(500), default="")
    portfolio_url: Mapped[str] = mapped_column(String(500), default="")
    linkedin_url: Mapped[str] = mapped_column(String(500), default="")
    # Uploaded resume (PDF stored on disk under UPLOAD_DIR; only metadata lives here)
    resume_filename: Mapped[str] = mapped_column(String(255), default="")
    resume_stored_name: Mapped[str] = mapped_column(String(80), default="")
    resume_size: Mapped[int] = mapped_column(default=0)
    resume_uploaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    resume_visibility: Mapped[str] = mapped_column(String(16), default="connections")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="student_profile")


class AlumniProfile(Base):
    __tablename__ = "alumni_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    usc_degree: Mapped[str] = mapped_column(String(160), default="")
    graduation_year: Mapped[Optional[int]] = mapped_column(default=None)
    current_company: Mapped[str] = mapped_column(String(160), default="", index=True)
    current_title: Mapped[str] = mapped_column(String(160), default="", index=True)
    industry: Mapped[str] = mapped_column(String(120), default="", index=True)
    experience: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    career_interests: Mapped[list] = mapped_column(JSON, default=list)
    bio: Mapped[str] = mapped_column(Text, default="")
    linkedin_url: Mapped[str] = mapped_column(String(500), default="")
    coffee_chat_available: Mapped[bool] = mapped_column(default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="alumni_profile")
