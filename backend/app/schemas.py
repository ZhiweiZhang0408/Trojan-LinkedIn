from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from .config import REFERRAL_DISCLAIMER, USC_EMAIL_DOMAINS
from .models import JobStatus, JobType, RequestStatus, Role, WorkMode


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
    deadline: date | None = None
    referral_available: bool = True
    referral_slots: int | None = Field(default=None, ge=0)
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
    deadline: date | None = None
    referral_available: bool | None = None
    referral_slots: int | None = Field(default=None, ge=0)
    referral_notes: str | None = None
    status: JobStatus | None = None


class JobOut(JobBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: JobStatus
    is_expired: bool
    request_count: int
    accepted_count: int
    created_at: datetime
    updated_at: datetime
    alumni: UserPublic
    referral_disclaimer: str = REFERRAL_DISCLAIMER
    # Only for a logged-in student: their request status for this job (None if they haven't requested)
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


# ---------- Referral requests ----------

class ReferralRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job: JobBrief
    student: UserPublic
    note: str
    profile_link: str | None
    has_resume: bool
    resume_filename: str | None
    status: RequestStatus
    alumni_response: str | None
    created_at: datetime
    updated_at: datetime


class ReferralDecision(BaseModel):
    status: Literal["accepted", "declined"]
    alumni_response: str | None = Field(default=None, max_length=2000)
