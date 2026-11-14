from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from .config import REFERRAL_DISCLAIMER, USC_EMAIL_DOMAINS
from .models import (
    JobStatus,
    JobType,
    RequestKind,
    RequestStatus,
    ResumeStatus,
    Role,
    WorkMode,
)


def is_usc_email(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower()
    return domain in USC_EMAIL_DOMAINS


# ---------- Auth / User ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt limit is 72 bytes
    full_name: str = Field(min_length=1, max_length=120)
    role: Role
    grad_year: int | None = Field(default=None, ge=1900, le=2100)
    major: str | None = None
    company: str | None = None
    title: str | None = None
    linkedin_url: str | None = None

    @model_validator(mode="after")
    def students_need_usc_email(self):
        if self.role == Role.student and not is_usc_email(self.email):
            raise ValueError("Students must register with a @usc.edu email")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    role: Role
    is_usc_verified: bool
    grad_year: int | None
    major: str | None
    company: str | None
    title: str | None
    linkedin_url: str | None


class UserMe(UserPublic):
    email: EmailStr
    is_email_verified: bool
    created_at: datetime


class RegisterResponse(BaseModel):
    message: str
    email: EmailStr
    # Only populated when EMAIL_BACKEND=console (dev mode) for frontend testing; always None in production
    dev_code: str | None = None


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class ResendCodeRequest(BaseModel):
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserMe


# ---------- Job posts ----------

class JobBase(BaseModel):
    company: str = Field(min_length=1, max_length=120)
    role_title: str = Field(min_length=1, max_length=160)
    team: str | None = None
    industry: str | None = None
    location: str | None = None
    work_mode: WorkMode = WorkMode.onsite
    job_type: JobType = JobType.full_time
    description: str = Field(min_length=1)
    requirements: str | None = None
    eligibility: str | None = None
    application_link: str | None = None
    application_instructions: str | None = None
    deadline: date | None = None
    # True = "Open to referral requests", False = "Role questions only"
    referral_available: bool = True
    referral_notes: str | None = None


class JobCreate(JobBase):
    @model_validator(mode="after")
    def deadline_not_past(self):
        if self.deadline and self.deadline < date.today():
            raise ValueError("deadline cannot be in the past")
        return self


class JobUpdate(BaseModel):
    company: str | None = None
    role_title: str | None = None
    team: str | None = None
    industry: str | None = None
    location: str | None = None
    work_mode: WorkMode | None = None
    job_type: JobType | None = None
    description: str | None = None
    requirements: str | None = None
    eligibility: str | None = None
    application_link: str | None = None
    application_instructions: str | None = None
    deadline: date | None = None
    referral_available: bool | None = None
    referral_notes: str | None = None
    status: JobStatus | None = None


class JobOut(JobBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: JobStatus
    is_expired: bool
    accepts_new_requests: bool
    request_count: int
    interested_count: int
    created_at: datetime
    updated_at: datetime
    alumni: UserPublic
    referral_disclaimer: str = REFERRAL_DISCLAIMER
    # Only for a logged-in student: their thread for this job (None if they haven't sent one)
    my_request_status: RequestStatus | None = None
    my_request_id: int | None = None


class JobList(BaseModel):
    total: int
    items: list[JobOut]


class JobBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company: str
    role_title: str
    status: JobStatus
    is_expired: bool
    alumni_id: int


# ---------- Resume content (shared contract with Backend B / AI features) ----------
# Every field is optional so imports can leave unsupported fields empty.

class ContactInfo(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    website: str | None = None


class EducationItem(BaseModel):
    school: str | None = None
    degree: str | None = None
    major: str | None = None
    start: str | None = None  # free text, e.g. "Aug 2023"
    end: str | None = None  # e.g. "May 2027" or "Present"
    gpa: str | None = None
    details: list[str] = []


class ExperienceItem(BaseModel):
    company: str | None = None
    title: str | None = None
    location: str | None = None
    start: str | None = None
    end: str | None = None
    bullets: list[str] = []


class ProjectItem(BaseModel):
    name: str | None = None
    role: str | None = None
    link: str | None = None
    start: str | None = None
    end: str | None = None
    bullets: list[str] = []


class ResumeContent(BaseModel):
    contact: ContactInfo = ContactInfo()
    summary: str | None = None
    education: list[EducationItem] = []
    experience: list[ExperienceItem] = []
    projects: list[ProjectItem] = []
    skills: list[str] = []


class ResumeCreate(BaseModel):
    """Manual entry route: saved as confirmed right away unless confirm=False."""

    label: str = Field(default="Base resume", max_length=120)
    content: ResumeContent
    confirm: bool = True


class ResumeUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=120)
    content: ResumeContent | None = None


class ResumeConfirm(BaseModel):
    """Confirm and Save: optionally send the student's final edits in the same call."""

    label: str | None = Field(default=None, max_length=120)
    content: ResumeContent | None = None


class ResumeVersionCreate(BaseModel):
    """Save a job-specific (tailored) version from a confirmed resume."""

    job_id: int | None = None
    label: str | None = Field(default=None, max_length=120)
    content: ResumeContent | None = None  # omit to start from an exact copy of the parent


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    label: str
    content: ResumeContent
    status: ResumeStatus
    parent_id: int | None
    job_id: int | None
    is_tailored: bool
    has_original_file: bool
    original_filename: str | None
    created_at: datetime
    updated_at: datetime


# ---------- Job requests & messages ----------

class JobRequestCreate(BaseModel):
    kind: RequestKind = RequestKind.referral
    note: str = Field(min_length=1, max_length=2000)  # the introduction
    resume_id: int | None = None  # required for referral requests
    share_original_file: bool = False  # also attach the original upload, clearly labeled

    @model_validator(mode="after")
    def referral_needs_resume(self):
        if self.kind == RequestKind.referral and self.resume_id is None:
            raise ValueError("A referral request must include a confirmed resume (resume_id)")
        if self.share_original_file and self.resume_id is None:
            raise ValueError("share_original_file requires resume_id")
        return self


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender: UserPublic
    body: str
    created_at: datetime


class JobRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job: JobBrief
    student: UserPublic
    kind: RequestKind
    note: str
    resume_id: int | None
    resume_snapshot: ResumeContent | None  # exactly what was submitted
    has_attachment: bool
    attachment_filename: str | None
    status: RequestStatus
    is_read_only: bool
    messages: list[MessageOut]
    created_at: datetime
    updated_at: datetime


class JobRequestStatusUpdate(BaseModel):
    status: Literal["pending", "interested", "declined"]
