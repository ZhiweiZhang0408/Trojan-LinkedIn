# TrojanLink AI: architecture and extension points

This repository implements **Version 1** of the *Authentication + Connections + Profiles* scope. It's built so the Job Posts module and future AI agent modules can plug in without changing existing behaviour.

## Version 1 scope

| In scope (implemented) | Out of scope for Version 1 |
| --- | --- |
| Registration, login, roles (student / alumni), JWT | USC SSO / identity verification |
| Student and alumni profiles, academic and professional background, skills, interests, goals | **Seminars, alumni lectures, recordings, video archives** (removed by team decision) |
| Basic resume upload and management (PDF upload / replace / view / remove, visibility) | **AI Resume Tailoring Agent** (job-description analysis, action-verb suggestions, tailored drafts): an optional later enhancement |
| Profile settings (search visibility, email sharing, resume visibility) | **Job Posts** (owned by another teammate) |
| Alumni discovery and search, student discovery | Real-time chat, email or push notifications |
| Connection requests (send, accept, decline, withdraw, remove), coffee chats, direct messages | |
| AI alumni recommendations and AI introduction drafts (deterministic, with an optional consented LLM) | |

## Layers

```text
routers/      HTTP only: parse input, check permissions, call services, shape responses
schemas/      Pydantic contracts (the API surface the frontends depend on)
services/     Business logic, no FastAPI imports:
              presenters.py      relationship rules (connected? can message? can see resume/email?)
              resumes.py         resume storage helpers (save / read / snapshot / delete)
              recommendation.py  deterministic alumni scoring + explanations
              message_generator.py  template introductions (facts only)
              llm.py             optional LLM adapter (key + per-request consent, fail-safe)
models/       SQLAlchemy tables; every table references users.id
security/     password hashing, JWT, get_current_user / require_role dependencies
```

## Extension point 1: Job Posts module

The Job Posts owner can add their module without editing Connections or Profiles code:

1. **Shared identity.** Use `users.id` as the foreign key for the poster (an alum) and the applicant (a student). Protect routes with `Depends(get_current_user)` or `Depends(require_role(UserRole.alumni))` from `app.security`. Tokens from `/auth/login` already work.
2. **Register the router.** Add `app/routers/jobs.py` with `APIRouter(prefix="/jobs", tags=["Job Posts"])` and one `app.include_router(jobs.router)` line in `main.py`. Add the models to `app/models/__init__.py` so `create_all` picks them up.
3. **Link to profiles.** A job post can show the poster with `presenters.brief(user)` (id, name, role, headline). The frontend links to `#/profiles/{id}`, and the "Connect" / "Coffee chat" buttons already exist there.
4. **Resumes for applications.** Call `resumes.snapshot_resume(student.student_profile, prefix=f"application-{id}")` when a student applies, and store the returned name on the application row. The application then keeps the exact submitted file even if the student later replaces their profile resume. Access to application resumes is the Job Posts module's own rule; profile resume visibility is unaffected.
5. **Messaging.** To let an alum message an applicant, the current rule (accepted connection or confirmed coffee chat) lives in one function: `presenters.messaging_status`. Extending it, for example "or has an application to my job", is a one-line change that the messaging endpoints and UI follow automatically.

## Extension point 2: AI agent modules

Version 1 has two AI features: recommendations and introduction drafts. Future agents, such as the optional resume-tailoring idea, should follow the same pattern:

- **Deterministic first.** Ship a rule-based result that works offline. The LLM can only *improve* it.
- **Consent per request.** Take a `use_llm: bool` (default `false`) and call the model only when `settings.llm_api_key` is set **and** `use_llm` is true. Tested in `tests/test_edge_cases.py::test_llm_only_called_with_key_and_explicit_consent`.
- **Minimal facts.** Send only the fields the task needs. Never send emails, passwords or other users' private data.
- **Fail safe.** `llm._call` returns `None` on any error, and the endpoint falls back to the deterministic result. Responses report `source: "template" | "llm"`.
- **Never act on the user's behalf.** Agents return drafts. Nothing is sent, submitted or saved without a user action.
- **Where to put it.** Add `app/services/<agent>.py` (logic plus prompt) and an endpoint under `/ai/...` in `routers/ai.py` or a new router. Read resume content through `resumes.read_resume(profile)`.

## Data and privacy rules (centralized)

| Rule | Where |
| --- | --- |
| Who can see an email | `presenters.can_see_email` (self, or trusted pair + owner setting) |
| Who can download a resume | `presenters.can_view_resume` (owner's `resume_visibility`) |
| Who can message whom | `presenters.messaging_status` (accepted connection **or** confirmed coffee chat) |
| Connection state transitions | `routers/connections.update_connection` (accept/decline/withdraw/remove; see the API guide) |
| Who appears in search / recommendations | `User.discoverable`, filtered in `routers/connections.py` and `routers/ai.py` |
| Profile edits | `PUT /profiles/me` only. No route edits another user |

## Reliability measures

- SQLite enforces foreign keys (`PRAGMA foreign_keys=ON`), so deleting a user cascades to their profile, connections, chats and messages instead of leaving orphans.
- One JSON error contract: validation `422`, state conflicts `409` with human-readable messages, and a global handler that turns unexpected exceptions into a generic `500` JSON. A raw crash would also drop the CORS headers and show up in browsers as a confusing CORS error.
- `/health` checks the database for deployment and integration scripts.
- The seed is deterministic and never runs twice. Tests reset the database per test.
- Status changes check the current state (`409` if already answered) and the actor (`403` or `404`), so double clicks and stale screens can't corrupt state.

## Database

SQLite with `Base.metadata.create_all` on startup, which is enough for the hackathon. Before teams share a database, add Alembic migrations and agree on the shared `users` table. The concept doc notes that separate implementations shouldn't assume compatible schemas.
