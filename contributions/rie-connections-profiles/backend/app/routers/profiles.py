from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User, UserRole
from ..schemas.profile import (
    ALUMNI_ONLY,
    STUDENT_ONLY,
    AlumniProfileData,
    ProfileOut,
    ProfileSettings,
    ProfileSettingsUpdate,
    ProfileUpdate,
    ResumeInfo,
    StudentProfileData,
)
from ..security import get_current_user, require_role
from ..services.presenters import (
    active_connection,
    can_see_email,
    can_view_resume,
    connection_statuses,
    ensure_profile,
    headline,
    messaging_status,
)
from ..services import resumes

router = APIRouter(prefix="/profiles", tags=["Profiles"])

def _resume_info(target: User) -> ResumeInfo | None:
    sp = target.student_profile
    if sp is None or not sp.resume_stored_name:
        return None
    return ResumeInfo(
        filename=sp.resume_filename,
        size=sp.resume_size,
        uploaded_at=sp.resume_uploaded_at or datetime.min,
        visibility=sp.resume_visibility or "connections",
    )


def _present(db: Session, viewer: User, target: User) -> ProfileOut:
    ensure_profile(db, target)
    is_me = viewer.id == target.id
    active = None if is_me else active_connection(db, viewer.id, target.id)
    out = ProfileOut(
        user_id=target.id,
        full_name=target.full_name,
        role=target.role,
        headline=headline(target),
        email=target.email if can_see_email(db, viewer, target) else None,
        is_me=is_me,
        connection_status=None if is_me else connection_statuses(db, viewer.id).get(target.id),
        connection_id=active.id if active else None,
        can_message=False if is_me else messaging_status(db, viewer, target)[0],
        resume=_resume_info(target) if can_view_resume(db, viewer, target) else None,
    )
    if target.role == UserRole.student:
        out.student = StudentProfileData.model_validate(target.student_profile)
    else:
        out.alumni = AlumniProfileData.model_validate(target.alumni_profile)
    return out


def _settings(user: User) -> ProfileSettings:
    return ProfileSettings(
        discoverable=bool(user.discoverable),
        show_email_to_connections=bool(user.show_email_to_connections),
        resume_visibility=(user.student_profile.resume_visibility or "connections")
        if user.role == UserRole.student and user.student_profile
        else None,
    )


@router.get("/me", response_model=ProfileOut)
def get_my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileOut:
    out = _present(db, user, user)
    db.commit()
    return out


@router.put("/me", response_model=ProfileOut)
def update_my_profile(
    body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProfileOut:
    """Create or update the caller's own profile. There is no endpoint to edit other users."""
    data = body.model_dump(exclude_unset=True)
    forbidden = (ALUMNI_ONLY if user.role == UserRole.student else STUDENT_ONLY) & data.keys()
    if forbidden:
        raise HTTPException(
            status_code=422,
            detail=f"Fields not allowed for the {user.role.value} role: {', '.join(sorted(forbidden))}",
        )
    if "full_name" in data:
        name = data.pop("full_name")
        if name:
            user.full_name = " ".join(name.split())
    profile = ensure_profile(db, user)
    for key, value in data.items():
        if value is None and key not in {"graduation_year"}:
            continue
        setattr(profile, key, value)
    db.commit()
    db.refresh(user)
    return _present(db, user, user)


# --------------------------------------------------------------------------- settings
@router.get("/me/settings", response_model=ProfileSettings, summary="My profile settings")
def get_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileSettings:
    ensure_profile(db, user)
    db.commit()
    return _settings(user)


@router.put("/me/settings", response_model=ProfileSettings, summary="Update my profile settings")
def update_settings(
    body: ProfileSettingsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProfileSettings:
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    if "resume_visibility" in data:
        if user.role != UserRole.student:
            raise HTTPException(422, "resume_visibility applies to student profiles only")
        ensure_profile(db, user).resume_visibility = data.pop("resume_visibility")
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return _settings(user)


# --------------------------------------------------------------------------- resume
@router.put("/me/resume", response_model=ResumeInfo, summary="Upload or replace my resume (PDF, students)")
async def upload_resume(
    file: UploadFile = File(..., description="PDF, up to MAX_RESUME_MB (default 5 MB)"),
    user: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
) -> ResumeInfo:
    data = await file.read(settings.max_resume_bytes + 1)
    sp = ensure_profile(db, user)
    try:
        old = resumes.save_resume(sp, user.id, data, file.filename)
    except resumes.ResumeError as exc:
        raise HTTPException(exc.status_code, str(exc))
    db.commit()
    resumes.delete_file(old)
    return _resume_info(user)


@router.delete("/me/resume", status_code=204, summary="Remove my uploaded resume")
def delete_resume(user: User = Depends(require_role(UserRole.student)), db: Session = Depends(get_db)) -> None:
    sp = ensure_profile(db, user)
    if not sp.resume_stored_name:
        raise HTTPException(404, "No resume uploaded")
    old = resumes.clear_resume(sp)
    db.commit()
    resumes.delete_file(old)


@router.get("/{user_id}/resume", summary="Download a student's resume (respects their visibility setting)",
            response_class=FileResponse)
def download_resume(user_id: int, viewer: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if target is None or not can_view_resume(db, viewer, target):
        raise HTTPException(404, "Resume not available")
    path = resumes.resume_path(target.student_profile)
    if path is None:
        raise HTTPException(404, "Resume not available")
    return FileResponse(path, media_type="application/pdf", filename=target.student_profile.resume_filename)


# --------------------------------------------------------------------------- view
@router.get("/{user_id}", response_model=ProfileOut)
def get_profile(user_id: int, viewer: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileOut:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    out = _present(db, viewer, target)
    db.commit()
    return out
