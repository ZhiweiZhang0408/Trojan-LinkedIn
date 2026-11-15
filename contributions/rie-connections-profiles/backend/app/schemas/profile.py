from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from ..models import UserRole
from .common import ORMModel, TagList, UrlStr

ResumeVisibility = Literal["private", "connections", "everyone"]


class StudentProfileData(ORMModel):
    major: str = ""
    degree_program: str = ""
    graduation_year: int | None = None
    skills: list[str] = []
    career_interests: list[str] = []
    target_roles: list[str] = []
    experience: str = ""
    bio: str = ""
    resume_url: str = ""
    portfolio_url: str = ""
    linkedin_url: str = ""


class AlumniProfileData(ORMModel):
    usc_degree: str = ""
    graduation_year: int | None = None
    current_company: str = ""
    current_title: str = ""
    industry: str = ""
    experience: str = ""
    skills: list[str] = []
    career_interests: list[str] = []
    bio: str = ""
    linkedin_url: str = ""
    coffee_chat_available: bool = True


class ResumeInfo(BaseModel):
    filename: str
    size: int
    uploaded_at: datetime
    visibility: ResumeVisibility


class ProfileOut(BaseModel):
    user_id: int
    full_name: str
    role: UserRole
    headline: str
    email: str | None = Field(
        default=None, description="Only visible to the owner and to accepted connections / confirmed chats"
    )
    is_me: bool = False
    connection_status: str | None = None
    connection_id: int | None = Field(
        default=None, description="Id of the active (pending or accepted) connection with this person, for PATCH actions"
    )
    can_message: bool = False
    resume: ResumeInfo | None = Field(default=None, description="Uploaded resume, if visible to the viewer")
    student: StudentProfileData | None = None
    alumni: AlumniProfileData | None = None


_YEAR = Field(default=None, ge=1950, le=2040)


class ProfileUpdate(BaseModel):
    """PUT /profiles/me. Send only fields for your role; omitted fields are unchanged."""

    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    graduation_year: int | None = _YEAR
    skills: TagList | None = None
    career_interests: TagList | None = None
    bio: str | None = Field(default=None, max_length=2000)
    experience: str | None = Field(
        default=None, max_length=4000, description="Alumni: professional experience. Students: internships, projects"
    )
    linkedin_url: UrlStr | None = None
    # student-only
    major: str | None = Field(default=None, max_length=120)
    degree_program: str | None = Field(default=None, max_length=120)
    target_roles: TagList | None = None
    resume_url: UrlStr | None = None
    portfolio_url: UrlStr | None = None
    # alumni-only
    usc_degree: str | None = Field(default=None, max_length=160)
    current_company: str | None = Field(default=None, max_length=160)
    current_title: str | None = Field(default=None, max_length=160)
    industry: str | None = Field(default=None, max_length=120)
    coffee_chat_available: bool | None = None


STUDENT_ONLY = {"major", "degree_program", "target_roles", "resume_url", "portfolio_url"}
ALUMNI_ONLY = {
    "usc_degree",
    "current_company",
    "current_title",
    "industry",
    "coffee_chat_available",
}


class ProfileSettings(BaseModel):
    discoverable: bool = Field(description="Appear in the directory, student search and recommendations")
    show_email_to_connections: bool = Field(description="Share your email with accepted connections / confirmed chats")
    resume_visibility: ResumeVisibility | None = Field(
        default=None, description="Students only: who can download your uploaded resume"
    )


class ProfileSettingsUpdate(BaseModel):
    discoverable: bool | None = None
    show_email_to_connections: bool | None = None
    resume_visibility: ResumeVisibility | None = None
