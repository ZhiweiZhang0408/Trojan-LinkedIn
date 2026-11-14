"""Auth flow:
1. POST /auth/register        -> create an unverified account and email a 6-digit code
2. POST /auth/verify-email    -> submit the code; on success returns a token (logged in)
3. POST /auth/login           -> later logins with email + password; unverified -> 403 email_not_verified
   POST /auth/resend-code     -> resend if the code never arrived or expired
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..mailer import send_verification_code
from ..models import EmailVerification, User
from ..schemas import (
    LoginRequest,
    RegisterResponse,
    ResendCodeRequest,
    Token,
    UserCreate,
    UserMe,
    VerifyEmailRequest,
    is_usc_email,
)
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)  # store naive UTC in the DB


def _hash_code(user_id: int, code: str) -> str:
    return hmac.new(config.SECRET_KEY.encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _issue_code(db: Session, user: User, background: BackgroundTasks) -> str:
    code = f"{secrets.randbelow(10**6):06d}"
    v = db.scalar(select(EmailVerification).where(EmailVerification.user_id == user.id))
    if v is None:
        v = EmailVerification(user_id=user.id)
        db.add(v)
    v.code_hash = _hash_code(user.id, code)
    v.expires_at = _now() + timedelta(minutes=config.VERIFICATION_CODE_TTL_MINUTES)
    v.attempts = 0
    v.sent_at = _now()
    db.commit()
    background.add_task(send_verification_code, user.email, code)
    return code


def _register_response(email: str, code: str) -> RegisterResponse:
    return RegisterResponse(
        message="Verification code sent. Check your inbox.",
        email=email,
        dev_code=code if config.EMAIL_BACKEND == "console" else None,
    )


def _token_response(user: User) -> Token:
    return Token(access_token=create_access_token(user), user=UserMe.model_validate(user))


def _get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def _authenticate(db: Session, email: str, password: str) -> User:
    user = _get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_email_verified:
        # frontend should route to the "enter code" screen on this detail
        raise HTTPException(status.HTTP_403_FORBIDDEN, "email_not_verified")
    return user


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    email = body.email.lower()
    fields = body.model_dump(exclude={"password", "email"})
    user = _get_user_by_email(db, email)

    if user and user.is_email_verified:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if user:
        # registered but never verified (e.g. lost the code): overwrite details and resend
        for k, v in fields.items():
            setattr(user, k, v)
        user.hashed_password = hash_password(body.password)
    else:
        user = User(**fields, email=email, hashed_password=hash_password(body.password))
        db.add(user)
    db.commit()
    db.refresh(user)

    return _register_response(email, _issue_code(db, user, background))


@router.post("/verify-email", response_model=Token)
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)):
    bad = HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    user = _get_user_by_email(db, body.email)
    if not user:
        raise bad
    if user.is_email_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already verified, please log in")

    v = db.scalar(select(EmailVerification).where(EmailVerification.user_id == user.id))
    if not v or v.expires_at < _now():
        raise bad
    if v.attempts >= config.MAX_CODE_ATTEMPTS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts, request a new code")

    if not hmac.compare_digest(v.code_hash, _hash_code(user.id, body.code)):
        v.attempts += 1
        db.commit()
        raise bad

    user.is_email_verified = True
    user.is_usc_verified = is_usc_email(user.email)
    db.delete(v)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/resend-code", response_model=RegisterResponse)
def resend_code(body: ResendCodeRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, body.email)
    if not user or user.is_email_verified:
        # don't reveal whether the email exists
        return RegisterResponse(message="If the account exists, a new code has been sent.", email=body.email)

    v = db.scalar(select(EmailVerification).where(EmailVerification.user_id == user.id))
    if v and (_now() - v.sent_at).total_seconds() < config.RESEND_COOLDOWN_SECONDS:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Please wait a minute before requesting another code")

    return _register_response(user.email, _issue_code(db, user, background))


@router.post("/login", response_model=Token)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Frontend login: JSON body {email, password}"""
    return _token_response(_authenticate(db, body.email, body.password))


@router.post("/token", response_model=Token)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 form login (username = email), used by the Swagger Authorize button"""
    return _token_response(_authenticate(db, form.username, form.password))


@router.get("/me", response_model=UserMe)
def me(user: User = Depends(get_current_user)):
    return user
