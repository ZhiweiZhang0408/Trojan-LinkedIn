"""Job request threads: a student's first request to a role's alum, plus follow-up messages.

Permissions: only the requesting student and the job's alum can see a thread,
its resume snapshot, its attachment, and its messages.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    JobPost,
    JobRequest,
    Message,
    RequestKind,
    RequestStatus,
    Resume,
    ResumeStatus,
    User,
)
from ..schemas import JobRequestCreate, JobRequestOut, JobRequestStatusUpdate, MessageCreate
from ..security import get_current_user, require_alumni, require_student

router = APIRouter(tags=["job requests"])

_LOAD = (
    selectinload(JobRequest.job),
    selectinload(JobRequest.student),
    selectinload(JobRequest.messages).selectinload(Message.sender),
)


def _get_thread(db: Session, request_id: int, user: User) -> JobRequest:
    req = db.get(JobRequest, request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if user.id not in (req.student_id, req.job.alumni_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    return req


@router.post(
    "/jobs/{job_id}/requests", response_model=JobRequestOut, status_code=status.HTTP_201_CREATED
)
def create_job_request(
    job_id: int,
    body: JobRequestCreate,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Request Referral (needs a confirmed resume) or Ask a Question (resume optional)."""
    job = db.get(JobPost, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if not job.accepts_new_requests:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This role is no longer accepting requests")
    if body.kind == RequestKind.referral and not job.referral_available:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This alum accepts role questions only for this post"
        )
    if db.scalar(
        select(JobRequest).where(JobRequest.job_id == job_id, JobRequest.student_id == user.id)
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You already have a thread for this role; reply there instead"
        )

    req = JobRequest(job_id=job_id, student_id=user.id, kind=body.kind, note=body.note.strip())

    if body.resume_id is not None:
        resume = db.get(Resume, body.resume_id)
        if not resume or resume.owner_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
        if resume.status != ResumeStatus.confirmed:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Confirm the resume before sending it")
        req.resume_id = resume.id
        req.resume_snapshot = dict(resume.content)  # frozen copy of what is being submitted
        if body.share_original_file:
            if not resume.original_file_path:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "This resume has no uploaded original file"
                )
            req.attachment_path = resume.original_file_path
            req.attachment_filename = resume.original_filename

    db.add(req)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You already have a thread for this role; reply there instead"
        )
    db.refresh(req)
    return req


@router.get("/job-requests/sent", response_model=list[JobRequestOut])
def my_sent_requests(user: User = Depends(require_student), db: Session = Depends(get_db)):
    """Student: Profile -> Job Requests."""
    stmt = (
        select(JobRequest)
        .where(JobRequest.student_id == user.id)
        .order_by(JobRequest.updated_at.desc(), JobRequest.id.desc())
        .options(*_LOAD)
    )
    return db.scalars(stmt).all()


@router.get("/job-requests/received", response_model=list[JobRequestOut])
def my_received_requests(
    job_id: int | None = None,
    status_filter: RequestStatus | None = None,
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
):
    """Alumni inbox, oldest first; filter by role (My Posts -> a role) and/or status."""
    stmt = (
        select(JobRequest)
        .join(JobPost)
        .where(JobPost.alumni_id == user.id)
        .order_by(JobRequest.created_at.asc(), JobRequest.id.asc())
        .options(*_LOAD)
    )
    if job_id is not None:
        stmt = stmt.where(JobRequest.job_id == job_id)
    if status_filter is not None:
        stmt = stmt.where(JobRequest.status == status_filter)
    return db.scalars(stmt).all()


@router.get("/job-requests/{request_id}", response_model=JobRequestOut)
def get_job_request(
    request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _get_thread(db, request_id, user)


@router.patch("/job-requests/{request_id}/status", response_model=JobRequestOut)
def update_request_status(
    request_id: int,
    body: JobRequestStatusUpdate,
    user: User = Depends(require_alumni),
    db: Session = Depends(get_db),
):
    """Alum marks Interested / Declined (or back to Pending). Declined is final in the MVP."""
    req = _get_thread(db, request_id, user)
    if req.job.alumni_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the role's alum can change status")
    if req.is_read_only:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Declined requests are read-only")
    req.status = RequestStatus(body.status)
    db.commit()
    db.refresh(req)
    return req


@router.post(
    "/job-requests/{request_id}/messages",
    response_model=JobRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def post_message(
    request_id: int,
    body: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reply in the thread (either party). Returns the whole updated thread."""
    req = _get_thread(db, request_id, user)
    if req.is_read_only:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Declined requests are read-only")
    db.add(Message(job_request_id=req.id, sender_id=user.id, body=body.body.strip()))
    req.updated_at = func.now()  # bump so the thread sorts as recently active
    db.commit()
    db.expire(req)
    return db.scalars(select(JobRequest).where(JobRequest.id == req.id).options(*_LOAD)).one()


@router.get("/job-requests/{request_id}/attachment")
def download_attachment(
    request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """The original uploaded resume, only if the student chose to share it."""
    req = _get_thread(db, request_id, user)
    if not req.attachment_path or not Path(req.attachment_path).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No attachment shared")
    return FileResponse(req.attachment_path, filename=req.attachment_filename)
