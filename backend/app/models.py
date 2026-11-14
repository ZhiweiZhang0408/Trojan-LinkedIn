import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(str, enum.Enum):
    student = "student"
    alumni = "alumni"


class JobStatus(str, enum.Enum):
    open = "open"
    closed = "closed"
    filled = "filled"


class JobType(str, enum.Enum):
    full_time = "full_time"
    internship = "internship"
    part_time = "part_time"
    contract = "contract"


class WorkMode(str, enum.Enum):
    onsite = "onsite"
    remote = "remote"
    hybrid = "hybrid"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    withdrawn = "withdrawn"
    closed = "closed"  # pending requests are auto-closed when the job is closed


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False, length=20))
    # is_email_verified: user proved ownership of the email via verification code
    # is_usc_verified:   email verified AND on a USC domain (frontend shows a "Verified Trojan" badge)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_usc_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Basic profile fields (the persona module owns the full profile)
    grad_year: Mapped[int | None] = mapped_column(default=None)
    major: Mapped[str | None] = mapped_column(String(120), default=None)
    company: Mapped[str | None] = mapped_column(String(120), default=None)
    title: Mapped[str | None] = mapped_column(String(120), default=None)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    job_posts: Mapped[list["JobPost"]] = relationship(back_populates="alumni")
    sent_requests: Mapped[list["ReferralRequest"]] = relationship(back_populates="student")


class JobPost(Base):
    __tablename__ = "job_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    alumni_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    company: Mapped[str] = mapped_column(String(120), index=True)
    role_title: Mapped[str] = mapped_column(String(160), index=True)
    team: Mapped[str | None] = mapped_column(String(160), default=None)
    industry: Mapped[str | None] = mapped_column(String(80), index=True, default=None)
    location: Mapped[str | None] = mapped_column(String(120), index=True, default=None)
    work_mode: Mapped[WorkMode] = mapped_column(Enum(WorkMode, native_enum=False, length=20), default=WorkMode.onsite)
    job_type: Mapped[JobType] = mapped_column(Enum(JobType, native_enum=False, length=20), default=JobType.full_time)

    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[str | None] = mapped_column(Text, default=None)
    eligibility: Mapped[str | None] = mapped_column(Text, default=None)
    application_link: Mapped[str | None] = mapped_column(String(500), default=None)
    deadline: Mapped[date | None] = mapped_column(Date, default=None)

    referral_available: Mapped[bool] = mapped_column(Boolean, default=True)
    referral_slots: Mapped[int | None] = mapped_column(default=None)
    referral_notes: Mapped[str | None] = mapped_column(Text, default=None)

    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, native_enum=False, length=20), default=JobStatus.open)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    alumni: Mapped[User] = relationship(back_populates="job_posts")
    referral_requests: Mapped[list["ReferralRequest"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )

    @property
    def is_expired(self) -> bool:
        return self.deadline is not None and self.deadline < date.today()

    @property
    def request_count(self) -> int:
        return len(self.referral_requests)

    @property
    def accepted_count(self) -> int:
        return sum(1 for r in self.referral_requests if r.status == RequestStatus.accepted)


class ReferralRequest(Base):
    __tablename__ = "referral_requests"
    __table_args__ = (UniqueConstraint("job_id", "student_id", name="uq_job_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_posts.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    note: Mapped[str] = mapped_column(Text)
    profile_link: Mapped[str | None] = mapped_column(String(500), default=None)
    resume_path: Mapped[str | None] = mapped_column(String(500), default=None)
    resume_filename: Mapped[str | None] = mapped_column(String(255), default=None)

    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, native_enum=False, length=20), default=RequestStatus.pending
    )
    alumni_response: Mapped[str | None] = mapped_column(Text, default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    job: Mapped[JobPost] = relationship(back_populates="referral_requests")
    student: Mapped[User] = relationship(back_populates="sent_requests")

    @property
    def has_resume(self) -> bool:
        return self.resume_path is not None


class EmailVerification(Base):
    """At most one active code per user (resending overwrites it). Only the hash is stored."""

    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(default=0)
    sent_at: Mapped[datetime] = mapped_column(DateTime)
