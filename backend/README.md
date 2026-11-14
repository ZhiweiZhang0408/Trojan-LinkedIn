# Alumni Referral Board — Backend (Auth + Job Posts + Referral Requests)

FastAPI + SQLAlchemy 2 + SQLite + JWT + email verification codes

## Getting started

```bash
cd backend
uv venv .venv --python 3.12 && uv pip install -p .venv/bin/python -r requirements.txt
cp .env.example .env                  # optional; works out of the box with SQLite
.venv/bin/python -m app.seed          # wipe the DB and load fictional demo data
.venv/bin/uvicorn app.main:app --reload
```
Tables are created automatically on startup.

Open http://localhost:8000/docs → click **Authorize** (top right, username = email) to try every endpoint.
Run tests: `.venv/bin/python -m pytest -q`

Demo accounts (password for all: `password123`):
- Alumni: `maya.chen@alumni.usc.edu`, `jordan.reyes@alumni.usc.edu`, `priya.nair@alumni.usc.edu`, `sam.okafor@example.com` (non-USC email, no Verified badge)
- Students: `alex.kim@usc.edu`, `taylor.brooks@usc.edu`

## Auth: .edu email verification

```
POST /auth/register ──► 6-digit code sent to email ──► POST /auth/verify-email ──► returns token (logged in)
Afterwards: POST /auth/login (email + password); unverified accounts get 403 {"detail": "email_not_verified"}
```
- Students must use `@usc.edu`. Verified + USC domain → `is_usc_verified=true` (frontend shows a "Verified Trojan" badge)
- Codes expire after 10 minutes, max 5 attempts, 60-second resend cooldown; only an HMAC hash is stored
- An unverified account can register again (overwrites details and sends a new code), so a lost code never locks anyone out
- **Dev mode** `EMAIL_BACKEND=console`: no real email is sent; the code is printed in the terminal and returned as `dev_code` from `/auth/register` — handy for frontend work and the demo
- **Real email** `EMAIL_BACKEND=smtp`: create a team Gmail, enable 2-Step Verification, generate an App Password, and put it in `.env`

## Auth conventions (for frontend / other modules)

- Verify or login returns `{access_token, token_type, user}`; send `Authorization: Bearer <token>` on every request after that
- Other modules (connections / persona) reuse auth:
  ```python
  from app.security import get_current_user, require_student, require_alumni

  @router.get("/x")
  def x(user = Depends(get_current_user)): ...
  ```
- Roles: `student` must register with `@usc.edu`; `alumni` may use any email, and verified `@usc.edu` / `@alumni.usc.edu` addresses get `is_usc_verified=true`

## API

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/register` | anyone | JSON sign-up, sends a code (returns `dev_code` in dev mode) |
| POST | `/auth/verify-email` | anyone | `{email, code}`, returns a token on success |
| POST | `/auth/resend-code` | anyone | `{email}` resend the code |
| POST | `/auth/login` | anyone | JSON `{email, password}` |
| POST | `/auth/token` | anyone | OAuth2 form login (used by Swagger) |
| GET | `/auth/me` | logged in | current user |
| GET | `/jobs` | anyone | list + filters: `q, company, industry, location, job_type, work_mode, referral_available, include_closed, include_expired, sort=newest\|deadline, limit, offset` |
| GET | `/jobs/{id}` | anyone | detail; a logged-in student also gets `my_request_status` |
| GET | `/jobs/mine` | alumni | my posts (with `request_count` / `accepted_count`) |
| POST | `/jobs` | alumni | create a post |
| PATCH | `/jobs/{id}` | poster | edit |
| POST | `/jobs/{id}/close?filled=true` | poster | close (pending requests become `closed`) |
| POST | `/jobs/{id}/reopen` | poster | reopen |
| DELETE | `/jobs/{id}` | poster | delete |
| POST | `/jobs/{id}/referral-requests` | student | **multipart/form-data**: `note` (≥20 chars), `profile_link`, `resume` (pdf/doc/docx ≤5MB) |
| GET | `/referral-requests/sent` | student | requests I sent |
| GET | `/referral-requests/received?job_id=&status_filter=` | alumni | inbox of received requests |
| GET | `/referral-requests/{id}` | either party | detail |
| PATCH | `/referral-requests/{id}/decision` | poster | `{status: accepted\|declined, alumni_response}` |
| POST | `/referral-requests/{id}/withdraw` | student | withdraw a pending request |
| GET | `/referral-requests/{id}/resume` | either party | download the resume |

Frontend resume upload example:
```js
const fd = new FormData();
fd.append("note", note);
fd.append("resume", fileInput.files[0]);
await fetch(`${API}/jobs/${id}/referral-requests`, {
  method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
});
```

## Statuses

- Job: `open` → `filled` / `closed`; past the `deadline` it becomes `is_expired=true` and is hidden from the default listing
- Referral request: `pending` → `accepted` / `declined` / `withdrawn` / `closed`
- Every job response includes `referral_disclaimer` ("a referral is not a guarantee of an interview or offer") — just display it

## Database & ownership

SQLite; the database file is not in git. **We only sync code**: schemas live in the models files, demo data lives in the seeds.
After every `git pull`, run `.venv/bin/python -m app.seed` and everyone's local data will match (this wipes local data).

| Module | Files the owner edits |
|---|---|
| Auth + Job Post + Referral | `app/models.py`, `app/routers/{auth,jobs,referrals}.py`, `app/seeds/core.py` |
| Connections | `app/models_connections.py`, `app/routers/connections.py`, `app/seeds/connections.py` |
| Persona | `app/models_persona.py`, `app/routers/persona.py`, `app/seeds/persona.py` |

- All modules share the 6 demo users from `seeds/core.py` (`users["alex"]`, `users["maya"]`, …) — don't create new ones
- Need demo data? Put it in your own seed file, not just in your local DB
- Check in before changing the `User` table; persona should use a separate `profiles` table
- Write code comments in English
- Demo day: one laptop runs `uvicorn app.main:app --host 0.0.0.0`; every frontend points at that laptop's LAN IP

## Known TODO (post-MVP)

- Rate-limit the login endpoint
