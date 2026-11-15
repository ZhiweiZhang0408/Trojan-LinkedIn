from __future__ import annotations

from pydantic import BaseModel, Field

from ..models import UserRole
from .common import EmailStr, ORMModel


class RegisterRequest(BaseModel):
    email: EmailStr = Field(examples=["new.student@example.com"])
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    role: UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_demo: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
