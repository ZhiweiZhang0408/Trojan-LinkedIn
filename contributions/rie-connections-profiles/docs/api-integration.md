# TrojanLink AI: API integration guide

**Final MVP scope:** Authentication, Profiles (including resume management and settings) and Connections (discovery, connection requests, coffee chats, direct messages), plus the AI layer. Seminars were removed from the MVP by team decision, and Job Posts belongs to another teammate.

This guide is for anyone connecting a different frontend, such as Jessica's, or another service such as the Job Posts module to this backend. Interactive docs are at **`http://localhost:8000/docs`** (Swagger) and `/redoc`.

## Conventions

| Topic | Convention |
| --- | --- |
| Base URL | `http://localhost:8000` (set `VITE_API_BASE_URL` in the frontend) |
| Auth | `Authorization: Bearer <access_token>` (JWT, HS256, default lifetime 8h) |
| Body format | JSON in, JSON out |
| Lists | Always `{ "items": [...], "total": n }` |
| Errors | FastAPI standard: `{ "detail": "message" }`. Validation errors (422) use `{ "detail": [{ "loc": [...], "msg": "..." }] }` |
| Status codes | `401` not logged in or bad token, `403` wrong role or not your resource, `404` not found or not visible to you, `409` state conflict (duplicate, already answered, wrong state), `413`/`415` resume too large / not a PDF, `422` invalid input, `500` unexpected (always `{"detail": "Something went wrong on the server. Please try again."}`, never internals) |
| Health | `GET /health` → `{ "status": "ok", "database": "ok" }`, or `503` if the database is unreachable |
| Times | ISO 8601. Stored as naive **local wall-clock time** (single-campus MVP). Send `2026-11-20T15:00:00` |
| CORS | Allowed origins come from `CORS_ORIGINS` (comma-separated) |

The ready-made TypeScript client lives in `frontend/src/services/api.ts`, with types in `frontend/src/services/types.ts`. Both can be copied into another React app as they are.

## Authentication

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ email, password (≥8), full_name, role: "student" \| "alumni" }` | `201 TokenResponse` |
| POST | `/auth/login` | `{ email, password }` | `TokenResponse` |
| GET | `/auth/me` | | `User` |
| POST | `/auth/logout` | | `204` (stateless JWT, so the client discards the token) |

`TokenResponse = { access_token, token_type: "bearer", user: { id, email, full_name, role, is_demo } }`

Registering also creates an empty role-specific profile. Accounts are self-reported and **not USC-verified**.

## Profiles

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/profiles/me` | Own profile |
| PUT | `/profiles/me` | Partial update of your own profile. Fields that belong to the other role return 422 |
| GET | `/profiles/{user_id}` | Any user's profile. `email` is `null` unless it's you, or an accepted connection / confirmed coffee chat **and** the owner allows it |
| GET | `/profiles/me/settings` | `{ discoverable, show_email_to_connections, resume_visibility }` (`resume_visibility` is `null` for alumni) |
| PUT | `/profiles/me/settings` | Partial update of the same fields |
| PUT | `/profiles/me/resume` | **Students only.** `multipart/form-data` with field `file` (PDF, ≤ 5 MB by default). Replaces any earlier upload. Returns `ResumeInfo` |
| DELETE | `/profiles/me/resume` | Remove the uploaded resume (`204`) |
| GET | `/profiles/{user_id}/resume` | Download the PDF if the owner's `resume_visibility` allows it, otherwise 404 |

There is deliberately no endpoint for editing someone else's profile.

`ProfileOut`:

```json
{
  "user_id": 1, "full_name": "Alex Chen", "role": "student", "headline": "Computer Science, Class of 2027",
  "email": "alex.chen@student.example.com", "is_me": true, "connection_status": null, "connection_id": null, "can_message": false,
  "resume": { "filename": "Alex_Chen_Resume.pdf", "size": 48213, "uploaded_at": "...", "visibility": "connections" },
  "student": { "major": "...", "degree_program": "B.S.", "graduation_year": 2027, "skills": [], "career_interests": [],
               "target_roles": [], "experience": "", "bio": "", "resume_url": "", "portfolio_url": "", "linkedin_url": "" },
  "alumni": null
}
```

Alumni profiles have `alumni: { usc_degree, graduation_year, current_company, current_title, industry, experience, skills, career_interests, bio, linkedin_url, coffee_chat_available }`.

`experience` is shared by both roles: professional experience for alumni, and internships, research and projects for students. `resume` appears only when the viewer is allowed to download it.

**Profile settings:**

| Setting | Default | Effect |
| --- | --- | --- |
| `discoverable` | `true` | When `false`, you're hidden from the alumni directory, student search and AI recommendations. People you're already connected with can still open your profile |
| `show_email_to_connections` | `true` | When `false`, your email is never shown to anyone else |
| `resume_visibility` (students) | `connections` | `private` (only you), `connections` (accepted connections and confirmed coffee chats), or `everyone` (any signed-in user) |

Uploaded PDFs are stored under `UPLOAD_DIR` (default `backend/uploads/`, git-ignored) with random server-side names. The check uses the `%PDF-` file signature, not just the extension.

`connection_status` is one of `connected`, `pending_outgoing`, `pending_incoming` or `null`.

## Connections

### Discovery

| Method | Path | Query parameters |
| --- | --- | --- |
| GET | `/connections/alumni` | `q`, `company`, `industry`, `title`, `skill` (comma-separated, all must match), `interest`, `degree`, `graduation_year`, `coffee_chat_only`, `sort=match\|name\|graduation_year`, `limit`, `offset` |
| GET | `/connections/students` | `q`, `interest`, `skill`, `major`, `limit` |

Alumni cards include a short `bio`, plus `match_score` (0–100) when the caller is a student. For other callers it is `null`. Only users with `discoverable: true` are listed.

### Connection requests (student↔student, student↔alumni)

| Method | Path | Body |
| --- | --- | --- |
| POST | `/connections/requests` | `{ addressee_id, message? }` |
| GET | `/connections/requests?status=` | `status`: `pending`, `accepted`, `declined`, `withdrawn`, `removed` |
| PATCH | `/connections/requests/{id}` | `{ action: "accept" \| "decline" \| "withdraw" \| "remove" }` |

| Action | Who | Allowed when | Result |
| --- | --- | --- | --- |
| `accept` / `decline` | recipient | `pending` | `accepted` / `declined` |
| `withdraw` | requester | `pending` | `withdrawn` |
| `remove` | either person | `accepted` | `removed`. Email sharing and messaging stop unless a confirmed coffee chat exists; past messages stay readable |

After `declined`, `withdrawn` or `removed`, either person can send a new request. A second request while one is pending or accepted returns `409` with a specific message ("You already sent…", "…already sent you a request. Accept it under Connections", "You're already connected…"). Profiles include `connection_id` (the active pending or accepted connection) so a UI can withdraw or remove directly from a profile page.

### Coffee chats

| Method | Path | Body or query |
| --- | --- | --- |
| POST | `/connections/coffee-chats` | `{ recipient_id, proposed_time, duration_minutes (15–120), message }` |
| GET | `/connections/coffee-chats` | `?status=pending\|accepted\|declined\|cancelled&direction=incoming\|outgoing` |
| PATCH | `/connections/coffee-chats/{id}` | `{ action: "accept" \| "decline" \| "cancel", note? }` |

`proposed_time` must be in the future and within the next 12 months. Rules: the recipient accepts or declines a pending request. The requester cancels a pending request. Either side can cancel an accepted chat. A duplicate pending request returns 409. Alumni who turned off coffee chats return 409. A confirmed chat unlocks direct messages, so the two people can agree on where to meet. **No emails or calendar invites are ever sent.**

### Direct messages

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/connections/messages` | Inbox: `{ items: [{ other, last_message, unread_count, can_message }], total, total_unread }`, newest first |
| GET | `/connections/messages/unread-count` | `{ unread }` for a nav badge |
| GET | `/connections/messages/{user_id}` | Conversation (oldest → newest) with `can_message` and a `reason` if it's locked. Marks incoming messages as read |
| POST | `/connections/messages/{user_id}` | `{ body }` (1–4000 chars). Returns `201 MessageOut` |

`MessageOut = { id, sender_id, recipient_id, body, created_at, read_at, is_mine }`. A non-null `read_at` on your own message is a read receipt.

**Who can message whom:** a student and an alum, or two students, can message once they have an **accepted connection** or a **confirmed coffee chat**. Until then, POST returns 403 with a reason. Cold outreach goes through connection requests or coffee chat requests, which each carry their own message. Alum↔alum messaging is not supported. Messages are never emailed or forwarded.

## AI

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/ai/status` | `{ llm_configured }` |
| POST | `/ai/recommend-alumni` | **Students only.** `{ career_interests?, skills?, target_roles?, limit?, use_llm? }`. Omitted fields fall back to the saved profile |
| POST | `/ai/generate-message` | **Students only.** `{ alumni_id, purpose, tone: "friendly"\|"formal", personal_note?, use_llm? }` |

**Recommendation scoring** is deterministic and transparent. Each component is scored 0–1 and then weighted:

| Component | Weight | How it is measured |
| --- | --- | --- |
| Career goal | 30 | Student interests and target roles mapped to a career taxonomy and compared with the alum's title, industry and interests |
| Skills | 30 | Synonym-aware overlap (4 shared skills = full marks) |
| Industry | 15 | The alum's industry is relevant to the student's goal categories |
| Job title | 15 | Token overlap with target roles, or goal keywords in the title |
| Background | 10 | Goal keywords and skills mentioned in the alum's experience and bio |

The response includes a per-component `breakdown`, an `explanation`, `shared_skills`, `shared_interests`, `conversation_topics` and a `disclaimer`. The score is a ranking aid, **not** a compatibility probability.

`purpose` is one of `coffee_chat`, `career_advice`, `industry_insight`, `application_advice` or `mentorship`. Messages use only facts from the two profiles plus the student's own `personal_note`. The response is a draft and is never sent.

**LLM use** happens only when `LLM_API_KEY` is set **and** the request has `use_llm: true` (explicit consent). Any LLM failure silently falls back to the deterministic result. The `source` / `explanation_source` fields show which path produced the text.

## Integrating the Job Posts module and future AI agents

See [architecture.md](architecture.md#extension-point-1-job-posts-module). In short, Job Posts adds its own router and models keyed on `users.id`, reuses `app.security` for auth and roles, and calls `app.services.resumes.snapshot_resume` to attach a student's resume to an application. Future AI agents follow the same pattern as the existing AI endpoints: deterministic first, LLM only with a key **and** `use_llm: true`, fail-safe, and drafts only.
