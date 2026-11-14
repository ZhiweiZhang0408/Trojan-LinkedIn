import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")  # local .env (never commit it)


DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'referral_board.db'}")

# Always override via environment variable in production
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production-0123456789")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
MAX_RESUME_BYTES = 5 * 1024 * 1024
ALLOWED_RESUME_EXTS = {".pdf", ".docx"}

# Students must sign up with a USC email. Alumni may use any email; is_usc_verified is set only
# when the email is verified AND belongs to a USC domain.
USC_EMAIL_DOMAINS = ("usc.edu", "alumni.usc.edu")

# ---- Email verification codes ----
# console: print the code to the server log and return it as dev_code from /auth/register (dev/demo)
# smtp:    actually send email (e.g. Gmail + App Password)
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "console")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER or "noreply@referral-board.local")

VERIFICATION_CODE_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60
MAX_CODE_ATTEMPTS = 5

# ---- AI (tailoring + alumni review) ----
# Credentials come from ANTHROPIC_API_KEY (or an `ant auth login` profile); never hardcode a key.
AI_MODEL = os.getenv("AI_MODEL", "claude-opus-5-5")
AI_EFFORT = os.getenv("AI_EFFORT", "medium")  # low | medium | high; medium keeps button clicks responsive
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "90"))

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

REFERRAL_DISCLAIMER = (
    "A referral is not a guarantee of an interview or a job offer. "
    "Alumni refer at their own discretion."
)
