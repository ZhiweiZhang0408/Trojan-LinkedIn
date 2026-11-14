"""API routes for the persona module (owner: persona teammate).

Auth is already handled; use the dependencies from app.security:

    @router.get("/me")
    def my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        ...
"""
from fastapi import APIRouter, Depends  # noqa: F401
from sqlalchemy.orm import Session  # noqa: F401

from ..database import get_db  # noqa: F401
from ..models import User  # noqa: F401
from ..security import get_current_user, require_alumni, require_student  # noqa: F401

router = APIRouter(prefix="/persona", tags=["persona"])
