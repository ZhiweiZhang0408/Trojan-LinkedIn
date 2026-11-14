import logging
import smtplib
from email.message import EmailMessage

from . import config

log = logging.getLogger("uvicorn.error")


def send_email(to: str, subject: str, body: str) -> None:
    if config.EMAIL_BACKEND == "smtp":
        msg = EmailMessage()
        msg["From"] = config.EMAIL_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        try:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as s:
                s.starttls()
                s.login(config.SMTP_USER, config.SMTP_PASSWORD)
                s.send_message(msg)
        except Exception:
            log.exception("Failed to send email to %s", to)
    else:
        log.info("[console email] to=%s subject=%s\n%s", to, subject, body)


def send_verification_code(to: str, code: str) -> None:
    send_email(
        to,
        "Your Alumni Referral Board verification code",
        f"Your verification code is {code}\n\n"
        f"It expires in {config.VERIFICATION_CODE_TTL_MINUTES} minutes. "
        "If you didn't sign up, you can ignore this email.",
    )
