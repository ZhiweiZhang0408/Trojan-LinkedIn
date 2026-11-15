"""Profiles (persona module): read your profile or someone else's, and edit your own.

PATCH /persona/me accepts the frontend's whole `Person` object (camelCase keys such as
openToConnect, program, year) as well as snake_case. Ported and simplified from Rie's
reference implementation (contributions/rie-connections-profiles).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Role, User
from ..models_connections import Connection, ConnectionStatus
from ..models_persona import Profile
from ..security import get_current_user, get_current_user_optional

router = APIRouter(prefix="/persona", tags=["persona"])


class PersonaOut(BaseModel):
    """One person: the team `User` fields plus their profile."""

    id: int
    full_name: str
    role: Role
    is_usc_verified: bool
    grad_year: int | None
    major: str | None
    company: str | None
    title: str | None
    linkedin_url: str | None
    email: str | None  # only for yourself or an accepted connection
    bio: str | None
    skills: list[str]
    experience: str | None
    education: str | None
    projects: str | None
    location: str | None
    open_to_connect: bool
    coffee_chats: bool
    scheduling_url: str | None
    discoverable: bool


class PersonaUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    bio: str | None = Field(default=None, max_length=2000)
    skills: list[str] | None = Field(default=None, max_length=30)
    experience: str | None = Field(default=None, max_length=4000)
    education: str | None = Field(default=None, max_length=2000)
    projects: str | None = Field(default=None, max_length=4000)
    location: str | None = Field(default=None, max_length=120)
    open_to_connect: bool | None = None
    coffee_chats: bool | None = None
    scheduling_url: str | None = Field(default=None, max_length=300)
    discoverable: bool | None = None
    # Stored on the team User table
    title: str | None = Field(default=None, max_length=120)
    company: str | None = Field(default=None, max_length=120)
    major: str | None = Field(default=None, max_length=120, alias="program")
    grad_year: int | None = Field(default=None, ge=1900, le=2100, alias="year")

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        out: list[str] = []
        for s in v:
            s = s.strip()[:60]
            if s and s.lower() not in (x.lower() for x in out):
                out.append(s)
        return out

    @field_validator("scheduling_url")
    @classmethod
    def http_only(cls, v: str | None) -> str | None:
        if v and not v.lower().startswith(("http://", "https://")):
            raise ValueError("Use an http or https link")
        return v or None


def profile_of(db: Session, user: User) -> Profile | None:
    return db.scalar(select(Profile).where(Profile.user_id == user.id))


def is_connected(db: Session, a: User, b: User) -> bool:
    return db.scalar(
        select(Connection.id).where(
            Connection.status == ConnectionStatus.accepted,
            or_(
                (Connection.student_id == a.id) & (Connection.alumni_id == b.id),
                (Connection.student_id == b.id) & (Connection.alumni_id == a.id),
            ),
        )
    ) is not None


def persona_out(db: Session, user: User, viewer: User | None) -> PersonaOut:
    p = profile_of(db, user)
    show_email = viewer is not None and (viewer.id == user.id or is_connected(db, viewer, user))
    return PersonaOut(
        id=user.id,
        full_name=user.full_name,
        role=user.role,
        is_usc_verified=user.is_usc_verified,
        grad_year=user.grad_year,
        major=user.major,
        company=user.company,
        title=user.title,
        linkedin_url=user.linkedin_url,
        email=user.email if show_email else None,
        bio=p.bio if p else None,
        skills=list(p.skills or []) if p else [],
        experience=p.experience if p else None,
        education=p.education if p else None,
        projects=p.projects if p else None,
        location=p.location if p else None,
        # No profile yet: alumni are open to connections by default, not to coffee chats
        open_to_connect=p.open_to_connect if p else user.role == Role.alumni,
        coffee_chats=p.coffee_chats if p else False,
        scheduling_url=p.scheduling_url if p else None,
        discoverable=p.discoverable if p else True,
    )


@router.get("/me", response_model=PersonaOut)
def my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return persona_out(db, user, user)


@router.patch("/me", response_model=PersonaOut)
def update_my_profile(
    body: PersonaUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    data = body.model_dump(exclude_unset=True)
    for field in ("title", "company", "major", "grad_year"):
        if field in data:
            setattr(user, field, data.pop(field) or None)
    p = profile_of(db, user)
    if p is None:
        p = Profile(user_id=user.id, open_to_connect=user.role == Role.alumni)
        db.add(p)
    for field, value in data.items():
        setattr(p, field, value if value is not None or field != "skills" else [])
    db.commit()
    db.refresh(user)
    return persona_out(db, user, user)


@router.get("/{user_id}", response_model=PersonaOut)
def get_profile(
    user_id: int,
    viewer: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    p = profile_of(db, user)
    hidden = p is not None and not p.discoverable
    if hidden and not (viewer and (viewer.id == user.id or is_connected(db, viewer, user))):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return persona_out(db, user, viewer)
