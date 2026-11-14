import enum
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
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


def _enum(cls: type[enum.Enum]) -> Enum:
    # Store enums as VARCHAR so adding a value never needs a DB-level type change
    return Enum(cls, native_enum=False, length=20)


class Role(str, enum.Enum):
    student = "student"
    alumni = "alumni"


class JobStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class JobType(str, enum.Enum):
    full_time = "full_time"
    internship = "internship"
    part_time = "part_time"
    contract = "contract"


class WorkMode(str, enum.Enum):
    onsite = "onsite"
    remote = "remote"
    hybrid = "hybrid"


class RequestKind(str, enum.Enum):
    referral = "referral"  # "Request Referral": requires a confirmed resume
    question = "question"  # "Ask a Question": resume optional


class RequestStatus(str, enum.Enum):
    pending = "pending"
    interested = "interested"  # alum is willing to discuss next steps
    declined = "declined"  # thread becomes read-only


class ResumeStatus(str, enum.Enum):
    draft = "draft"  # e.g. an import awaiting the student's review
    confirmed = "confirmed"  # usable for tailoring and requests


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(_enum(Role))
    # is_email_verified: user proved ownership of the email via verification code
    # is_usc_verified:   email verified AND on a USC domain (frontend shows a "Verified Trojan" badge)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_usc_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Basic profile fields (the full profile lives in the profile module)
    grad_year: Mapped[int | None] = mapped_column(default=None)
    major: Mapped[str | None] = mapped_column(String(120), default=None)
    company: Mapped[str | None] = mapped_column(String(120), default=None)
    title: Mapped[str | None] = mapped_column(String(120), default=None)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    job_posts: Mapped[list["JobPost"]] = relationship(back_populates="alumni")
    sent_requests: Mapped[list["JobRequest"]] = relationship(back_populates="student")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="owner")


class JobPost(Base):
    __tablename__ = "job_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    alumni_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    company: Mapped[str] = mapped_column(String(120), index=True)
    role_title: Mapped[str] = mapped_column(String(160), index=True)
    team: Mapped[str | None] = mapped_column(String(160), default=None)
    industry: Mapped[str | None] = mapped_column(String(80), index=True, default=None)
    location: Mapped[str | None] = mapped_column(String(120), index=True, default=None)
    work_mode: Mapped[WorkMode] = mapped_column(_enum(WorkMode), default=WorkMode.onsite)
    job_type: Mapped[JobType] = mapped_column(_enum(JobType), default=JobType.full_time)

    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[str | None] = mapped_column(Text, default=None)
    eligibility: Mapped[str | None] = mapped_column(Text, default=None)
    application_link: Mapped[str | None] = mapped_column(String(500), default=None)
    # Official application steps (e.g. "Apply on the careers site first, then send me the req ID")
    application_instructions: Mapped[str | None] = mapped_column(Text, default=None)
    deadline: Mapped[date | None] = mapped_column(Date, default=None)

    # True  = "Open to referral requests" (Request Referral + Ask a Question)
    # False = "Role questions only"       (Ask a Question only)
    referral_available: Mapped[bool] = mapped_column(Boolean, default=True)
    referral_notes: Mapped[str | None] = mapped_column(Text, default=None)

    status: Mapped[JobStatus] = mapped_column(_enum(JobStatus), default=JobStatus.open)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    alumni: Mapped[User] = relationship(back_populates="job_posts")
    requests: Mapped[list["JobRequest"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )

    @property
    def is_expired(self) -> bool:
        return self.deadline is not None and self.deadline < date.today()

    @property
    def accepts_new_requests(self) -> bool:
        return self.status == JobStatus.open and not self.is_expired

    @property
    def request_count(self) -> int:
        return len(self.requests)

    @property
    def interested_count(self) -> int:
        return sum(1 for r in self.requests if r.status == RequestStatus.interested)


class Resume(Base):
    """One row per resume version.

    - Base resume: parent_id is None (from manual entry or a confirmed import)
    - Tailored version: parent_id points to the base, job_id to the target role
    Editing a tailored version never changes its base; sent requests keep their own snapshot.
    """

    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[str] = mapped_column(String(120), default="Base resume")
    # Structured sections; shape defined by schemas.ResumeContent (shared with Backend B / AI)
    content: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[ResumeStatus] = mapped_column(_enum(ResumeStatus), default=ResumeStatus.draft)

    parent_id: Mapped[int | None] = mapped_column(ForeignKey("resumes.id"), default=None)
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("job_posts.id", ondelete="SET NULL"), default=None
    )

    # Present only when created from an upload; the file is private to its owner
    source_text: Mapped[str | None] = mapped_column(Text, default=None)
    original_file_path: Mapped[str | None] = mapped_column(String(500), default=None)
    original_filename: Mapped[str | None] = mapped_column(String(255), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped[User] = relationship(back_populates="resumes")

    @property
    def is_tailored(self) -> bool:
        return self.parent_id is not None

    @property
    def has_original_file(self) -> bool:
        return self.original_file_path is not None


class JobRequest(Base):
    """One thread per student + role: the first request plus all follow-up messages."""

    __tablename__ = "job_requests"
    __table_args__ = (UniqueConstraint("job_id", "student_id", name="uq_job_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_posts.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    kind: Mapped[RequestKind] = mapped_column(_enum(RequestKind), default=RequestKind.referral)
    note: Mapped[str] = mapped_column(Text)  # the student's introduction

    # Which version was selected, plus a frozen copy of its content at submission time.
    # The snapshot is what the alum (and alumni AI review) sees; later edits don't change it.
    resume_id: Mapped[int | None] = mapped_column(
        ForeignKey("resumes.id", ondelete="SET NULL"), default=None
    )
    resume_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)

    # Original uploaded file, only if the student explicitly chose to share it
    attachment_path: Mapped[str | None] = mapped_column(String(500), default=None)
    attachment_filename: Mapped[str | None] = mapped_column(String(255), default=None)

    status: Mapped[RequestStatus] = mapped_column(
        _enum(RequestStatus), default=RequestStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    job: Mapped[JobPost] = relationship(back_populates="requests")
    student: Mapped[User] = relationship(back_populates="sent_requests")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="job_request",
        cascade="all, delete-orphan",
        order_by="(Message.created_at, Message.id)",
    )

    @property
    def has_attachment(self) -> bool:
        return self.attachment_path is not None

    @property
    def is_read_only(self) -> bool:
        return self.status == RequestStatus.declined


class Message(Base):
    """A text reply inside a job request thread."""

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_request_id: Mapped[int] = mapped_column(
        ForeignKey("job_requests.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    job_request: Mapped[JobRequest] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship()


class EmailVerification(Base):
    """At most one active code per user (resending overwrites it). Only the hash is stored."""

    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(default=0)
    sent_at: Mapped[datetime] = mapped_column(DateTime)


class AIResult(Base):
    """Stored AI output, tied to the exact input it analyzed.

    kind="tailor": resume_id + job_id; kind="review": job_request_id (its frozen snapshot).
    input_hash lets us reuse a result when nothing changed instead of calling the model again.
    """

    __tablename__ = "ai_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    resume_id: Mapped[int | None] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"), index=True, default=None
    )
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("job_posts.id", ondelete="CASCADE"), default=None
    )
    job_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("job_requests.id", ondelete="CASCADE"), index=True, default=None
    )
    input_hash: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(60))
    output: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
