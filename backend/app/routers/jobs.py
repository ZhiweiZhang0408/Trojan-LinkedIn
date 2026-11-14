from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import JobPost, JobStatus, JobType, ReferralRequest, RequestStatus, Role, User, WorkMode
from ..schemas import JobCreate, JobList, JobOut, JobUpdate
from ..security import get_current_user_optional, require_alumni

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _get_job_or_404(db: Session, job_id: int) -> JobPost:
    job = db.get(JobPost, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job


def _get_owned_job(db: Session, job_id: int, user: User) -> JobPost:
    job = _get_job_or_404(db, job_id)
    if job.alumni_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only manage your own posts")
    return job


def _close_pending_requests(job: JobPost) -> None:
    for r in job.referral_requests:
        if r.status == RequestStatus.pending:
            r.status = RequestStatus.closed


@router.get("", response_model=JobList)
def list_jobs(
    q: str | None = Query(None, description="Keyword: matches company / role / team / description"),
    company: str | None = None,
    industry: str | None = None,
    location: str | None = None,
    job_type: JobType | None = None,
    work_mode: WorkMode | None = None,
    referral_available: bool | None = None,
    include_closed: bool = False,
    include_expired: bool = False,
    sort: Literal["newest", "deadline"] = "newest",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(JobPost)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                JobPost.company.ilike(like),
                JobPost.role_title.ilike(like),
                JobPost.team.ilike(like),
                JobPost.description.ilike(like),
            )
        )
    if company:
        stmt = stmt.where(JobPost.company.ilike(f"%{company}%"))
    if industry:
        stmt = stmt.where(JobPost.industry.ilike(f"%{industry}%"))
    if location:
        stmt = stmt.where(JobPost.location.ilike(f"%{location}%"))
    if job_type:
        stmt = stmt.where(JobPost.job_type == job_type)
    if work_mode:
        stmt = stmt.where(JobPost.work_mode == work_mode)
    if referral_available is not None:
        stmt = stmt.where(JobPost.referral_available == referral_available)
    if not include_closed:
        stmt = stmt.where(JobPost.status == JobStatus.open)
    if not include_expired:
        stmt = stmt.where(or_(JobPost.deadline.is_(None), JobPost.deadline >= date.today()))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    if sort == "deadline":
        stmt = stmt.order_by(JobPost.deadline.is_(None), JobPost.deadline.asc())
    else:
        stmt = stmt.order_by(JobPost.created_at.desc(), JobPost.id.desc())

    stmt = stmt.options(
        selectinload(JobPost.alumni), selectinload(JobPost.referral_requests)
    ).limit(limit).offset(offset)
    return JobList(total=total, items=db.scalars(stmt).all())


@router.get("/mine", response_model=list[JobOut])
def my_posts(user: User = Depends(require_alumni), db: Session = Depends(get_db)):
    """Alumni dashboard: all my posts, including closed/expired"""
    stmt = (
        select(JobPost)
        .where(JobPost.alumni_id == user.id)
        .order_by(JobPost.created_at.desc(), JobPost.id.desc())
        .options(selectinload(JobPost.alumni), selectinload(JobPost.referral_requests))
    )
    return db.scalars(stmt).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    job = _get_job_or_404(db, job_id)
    out = JobOut.model_validate(job)
    if user and user.role == Role.student:
        req = db.scalar(
            select(ReferralRequest).where(
                ReferralRequest.job_id == job_id, ReferralRequest.student_id == user.id
            )
        )
        if req:
            out.my_request_status = req.status
            out.my_request_id = req.id
    return out


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(body: JobCreate, user: User = Depends(require_alumni), db: Session = Depends(get_db)):
    job = JobPost(**body.model_dump(), alumni_id=user.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.patch("/{job_id}", response_model=JobOut)
def update_job(
    job_id: int, body: JobUpdate, user: User = Depends(require_alumni), db: Session = Depends(get_db)
):
    job = _get_owned_job(db, job_id, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    if job.status != JobStatus.open:
        _close_pending_requests(job)
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/close", response_model=JobOut)
def close_job(
    job_id: int,
    filled: bool = Query(True, description="true = role filled, false = just closed"),
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
):
    job = _get_owned_job(db, job_id, user)
    job.status = JobStatus.filled if filled else JobStatus.closed
    _close_pending_requests(job)
    db.commit()
    db.refresh(job)
    return job


@router.post("/{job_id}/reopen", response_model=JobOut)
def reopen_job(job_id: int, user: User = Depends(require_alumni), db: Session = Depends(get_db)):
    job = _get_owned_job(db, job_id, user)
    job.status = JobStatus.open
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, user: User = Depends(require_alumni), db: Session = Depends(get_db)):
    job = _get_owned_job(db, job_id, user)
    db.delete(job)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
