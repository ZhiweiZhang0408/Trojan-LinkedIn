# Connections & Profiles API — Handoff Reference

**Source:** `Applepan55/trojanlink-claude`, commit `1254d56` (Claude implementation, Version 1).
**Audience:** TrojanLink teammates who did not build this implementation.
**Status legend:**

- **Implemented** = exists in this repository's code and is covered by tests (`backend/tests/`).
- **Expected by team frontend** = called by Jessica's frontend in `ZhiweiZhang0408/Trojan-LinkedIn` (`frontend/src/useBoard.ts`) but **not implemented** anywhere yet. Those are listed separately in [section 12](#12-apis-expected-by-the-team-frontend-not-implemented) and in `API_COMPATIBILITY_MATRIX.md`.

Every request/response example below was captured from the running code against the demo seed (ids and timestamps will differ on your machine). Interactive docs: run the backend and open `http://localhost:8000/docs`.

---

## 1. Conventions

| Topic | Convention |
| --- | --- |
| Base URL | `http://localhost:8000` |
| Format | JSON in and out, except resume upload (`multipart/form-data`) and resume download (PDF) |
| Auth | `Authorization: Bearer <access_token>` on every endpoint except `/auth/register`, `/auth/login`, `/ai/status`, `/health` |
| Lists | Always `{ "items": [...], "total": n }` (inbox adds `total_unread`) |
| Errors | `{ "detail": "message" }`; validation errors use FastAPI's list form (see [section 11](#11-errors-and-status-codes)) |
| Ids | Integers. Every table references `users.id` |
| Times | ISO 8601, stored as naive local wall-clock time (e.g. `"2026-11-18T15:00:00"`) |
| Roles | `student` or `alumni` |

## 2. Authentication (implemented here — **do not port**)

The Claude implementation has its own minimal login so it can run standalone. **The team repository already has the official login** (email verification, `@usc.edu` rule, bcrypt). When integrating, the Connections and Profiles routes should use the team's `app.security.get_current_user`, `require_student` and `require_alumni` instead. The JWT shape is the same in both (`sub` = user id, `role`).

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | `{email, password (≥8), full_name, role}` → `201` token |
| POST | `/auth/login` | public | `{email, password}` → token |
| GET | `/auth/me` | bearer | current user |
| POST | `/auth/logout` | bearer | `204` (stateless JWT) |

```json
// POST /auth/login → 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "token_type": "bearer",
  "user": { "id": 1, "email": "alex.chen@student.example.com", "full_name": "Alex Chen", "role": "student", "is_demo": true }
}
```

## 3. Data model (implemented)

All tables are SQLAlchemy 2 models in `backend/app/models/`. Foreign keys use `ON DELETE CASCADE`, and SQLite foreign-key enforcement is turned on.

```text
users ──1:1── student_profiles      (role = student)
  │   ──1:1── alumni_profiles       (role = alumni)
  │
  ├── connections     (requester_id, addressee_id → users)
  ├── coffee_chats    (requester_id, recipient_id → users)
  └── messages        (sender_id, recipient_id → users)   ⚠ name collides with the team's `messages` table
```

| Table | Columns (besides `id`) | Notes |
| --- | --- | --- |
| `users` | `email` (unique), `hashed_password`, `full_name`, `role`, `is_demo`, `discoverable`, `show_email_to_connections`, `created_at` | ⚠ The team already owns `users`; the two settings columns belong in a profile table when integrated |
| `student_profiles` | `user_id` (unique), `major`, `degree_program`, `graduation_year`, `skills` (JSON list), `career_interests` (JSON), `target_roles` (JSON), `experience`, `bio`, `resume_url`, `portfolio_url`, `linkedin_url`, `resume_filename`, `resume_stored_name`, `resume_size`, `resume_uploaded_at`, `resume_visibility`, `updated_at` | Resume columns hold metadata only; the PDF is on disk under `UPLOAD_DIR` |
| `alumni_profiles` | `user_id` (unique), `usc_degree`, `graduation_year`, `current_company`, `current_title`, `industry`, `experience`, `skills` (JSON), `career_interests` (JSON), `bio`, `linkedin_url`, `coffee_chat_available`, `updated_at` | |
| `connections` | `requester_id`, `addressee_id`, `message`, `status` (`pending` · `accepted` · `declined` · `withdrawn` · `removed`), `created_at`, `updated_at` | History is kept; a new request creates a new row |
| `coffee_chats` | `requester_id`, `recipient_id`, `proposed_time`, `duration_minutes`, `message`, `response_note`, `status` (`pending` · `accepted` · `declined` · `cancelled`), `created_at`, `updated_at` | |
| `messages` | `sender_id`, `recipient_id`, `body`, `created_at`, `read_at` | One conversation per pair of users |

## 4. Profiles (implemented)

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/profiles/me` | any user | My profile |
| PUT | `/profiles/me` | any user | Partial update of my profile (only fields I send change) |
| GET | `/profiles/{user_id}` | any user | Someone's profile, with privacy rules applied |

There is **no endpoint to edit another user's profile**. Fields for the other role are rejected with `422` (e.g. a student sending `current_company`).

Profile response shape (`ProfileOut`): exactly one of `student` / `alumni` is filled.

```json
// GET /profiles/7 (Sarah, viewed by an unconnected student) → 200
{
  "user_id": 7,
  "full_name": "Sarah Kim",
  "role": "alumni",
  "headline": "Senior Software Engineer at Brightline Cloud",
  "email": null,                 // hidden: not connected (see privacy rules)
  "is_me": false,
  "connection_status": null,     // null | "connected" | "pending_outgoing" | "pending_incoming"
  "connection_id": null,         // id of the active pending/accepted connection, for PATCH actions
  "can_message": false,
  "resume": null,                // students only, and only if visible to the viewer
  "student": null,
  "alumni": {
    "usc_degree": "B.S. Computer Science",
    "graduation_year": 2018,
    "current_company": "Brightline Cloud",
    "current_title": "Senior Software Engineer",
    "industry": "Technology",
    "experience": "Builds backend services for a cloud data platform. ...",
    "skills": ["Python", "Go", "Distributed Systems", "AWS", "Machine Learning"],
    "career_interests": ["Software Engineering", "Machine Learning & AI"],
    "bio": "Happy to talk about the transition from USC to full-time software engineering.",
    "linkedin_url": "",
    "coffee_chat_available": true
  }
}
```

Student `student` block fields: `major`, `degree_program`, `graduation_year`, `skills`, `career_interests`, `target_roles`, `experience`, `bio`, `resume_url`, `portfolio_url`, `linkedin_url`.

```json
// PUT /profiles/me (student) — request
{ "career_interests": ["Machine Learning & AI", "Software Engineering"], "target_roles": ["Software Engineer"] }
// → 200, returns the full ProfileOut with the updated student block
```

Updatable fields: shared `full_name`, `graduation_year`, `skills`, `career_interests`, `bio`, `experience`, `linkedin_url`; student-only `major`, `degree_program`, `target_roles`, `resume_url`, `portfolio_url`; alumni-only `usc_degree`, `current_company`, `current_title`, `industry`, `coffee_chat_available`. Validation: URLs must be `http(s)://`, years 1950–2040, tag lists de-duplicated (max 30).

## 5. Resume management and privacy settings (implemented)

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| PUT | `/profiles/me/resume` | student | Upload or replace a PDF (`multipart/form-data`, field `file`, ≤ 5 MB) |
| DELETE | `/profiles/me/resume` | student | Remove it (`204`) |
| GET | `/profiles/{user_id}/resume` | any user | Download the PDF if the owner's visibility allows, else `404` |
| GET | `/profiles/me/settings` | any user | Read privacy settings |
| PUT | `/profiles/me/settings` | any user | Update privacy settings (partial) |

```json
// PUT /profiles/me/resume → 200
{ "filename": "Alex_Chen_Resume.pdf", "size": 15, "uploaded_at": "2026-11-15T01:16:47.777527", "visibility": "connections" }
// Not a PDF → 415 { "detail": "Resume must be a PDF file" };  too large → 413
```

```json
// GET /profiles/me/settings → 200
{ "discoverable": true, "show_email_to_connections": true, "resume_visibility": "connections" }
```

| Setting | Values | Effect |
| --- | --- | --- |
| `discoverable` | `true` / `false` | `false` hides the user from `/connections/alumni`, `/connections/students` and recommendations |
| `show_email_to_connections` | `true` / `false` | `false` hides the email from everyone else |
| `resume_visibility` (students; `null` for alumni) | `private` · `connections` · `everyone` | Who may download the uploaded resume. `connections` = accepted connection or confirmed coffee chat |

The file is checked against the PDF signature (`%PDF-`), stored under a random server-side name, and never served by its original name on disk. Storage helpers live in `backend/app/services/resumes.py`.

> ⚠ The team repository already has a full resume system (`/resumes`, structured content, versions). This resume feature should **not** be ported as a second storage system; see `TEAM_INTEGRATION_GUIDE.md`.

## 6. Discovery (implemented)

| Method | Path | Query parameters |
| --- | --- | --- |
| GET | `/connections/alumni` | `q`, `company`, `industry`, `title`, `skill` (comma-separated, all must match), `interest`, `degree`, `graduation_year`, `coffee_chat_only`, `sort` (`match` · `name` · `graduation_year`), `limit` (1–100), `offset` |
| GET | `/connections/students` | `q`, `interest`, `skill`, `major`, `limit` |

Text filters are case-insensitive "contains". `match_score` is filled only when the caller is a student.

```json
// GET /connections/alumni?company=brightline → 200 (first item shown)
{
  "items": [{
    "user_id": 7, "full_name": "Sarah Kim",
    "current_title": "Senior Software Engineer", "current_company": "Brightline Cloud",
    "industry": "Technology", "usc_degree": "B.S. Computer Science", "graduation_year": 2018,
    "skills": ["Python", "Go", "Distributed Systems", "AWS", "Machine Learning"],
    "career_interests": ["Software Engineering", "Machine Learning & AI"],
    "bio": "Happy to talk about the transition from USC to full-time software engineering.",
    "coffee_chat_available": true, "match_score": 85, "connection_status": null
  }],
  "total": 2
}
```

```json
// GET /connections/students → 200 (first item shown)
{
  "items": [{
    "user_id": 4, "full_name": "Mia Nguyen", "major": "Applied Data Science", "degree_program": "M.S.",
    "graduation_year": 2026, "skills": ["Python", "Statistics", "Machine Learning", "Tableau", "SQL"],
    "career_interests": ["Data Science & Analytics", "Healthcare & Biotech"], "target_roles": ["Data Scientist"],
    "shared_interests": [], "shared_skills": ["Python", "Machine Learning", "SQL"],
    "connection_status": "pending_incoming"
  }],
  "total": 5
}
```

## 7. Connection requests (implemented)

Student↔student and student↔alumni. Alumni↔alumni is rejected (`400`).

| Method | Path | Body | Who |
| --- | --- | --- | --- |
| POST | `/connections/requests` | `{ "addressee_id": 7, "message": "..." }` (message optional, ≤ 1000) | sender |
| GET | `/connections/requests` | query `status` = `pending` · `accepted` · `declined` · `withdrawn` · `removed` | either side |
| PATCH | `/connections/requests/{id}` | `{ "action": "accept" \| "decline" \| "withdraw" \| "remove" }` | see workflow |

```json
// POST /connections/requests → 201
{
  "id": 5,
  "requester": { "id": 1, "full_name": "Alex Chen", "role": "student", "headline": "Computer Science, Class of 2027" },
  "addressee": { "id": 7, "full_name": "Sarah Kim", "role": "alumni", "headline": "Senior Software Engineer at Brightline Cloud" },
  "message": "Hi Sarah, I'd love to connect.",
  "status": "pending",
  "direction": "outgoing",          // relative to the caller
  "created_at": "2026-11-15T01:16:47.831748"
}
```

**Workflow**

```text
              accept (recipient)
  pending ───────────────────────► accepted ──── remove (either side) ───► removed
     │  └── decline (recipient) ─► declined
     └───── withdraw (sender) ───► withdrawn
  After declined / withdrawn / removed, either person may send a new request.
```

| Action | Who | Allowed when | Otherwise |
| --- | --- | --- | --- |
| `accept`, `decline` | recipient | `pending` | `403` wrong person · `409` wrong state |
| `withdraw` | sender | `pending` | `403` · `409` |
| `remove` | either person | `accepted` | `409` |

Conflicts return specific messages: `"You already sent Sarah Kim a request"`, `"<name> already sent you a request. Accept it under Connections"`, `"You're already connected with <name>"`. Removing a connection stops email sharing and messaging unless the two still have a confirmed coffee chat; earlier messages stay readable.

## 8. Coffee chats (implemented)

| Method | Path | Body / query | Who |
| --- | --- | --- | --- |
| POST | `/connections/coffee-chats` | `{ "recipient_id", "proposed_time", "duration_minutes" (15–120, default 30), "message" (≤ 2000) }` | requester |
| GET | `/connections/coffee-chats` | `status` = `pending` · `accepted` · `declined` · `cancelled`; `direction` = `incoming` · `outgoing` | either side |
| PATCH | `/connections/coffee-chats/{id}` | `{ "action": "accept" \| "decline" \| "cancel", "note": "..." }` | see workflow |

```json
// POST /connections/coffee-chats → 201
// request: { "recipient_id": 7, "proposed_time": "2026-11-18T15:00:00", "duration_minutes": 30,
//            "message": "Hi Sarah, would you have 30 minutes for a coffee chat?" }
{
  "id": 4,
  "requester": { "id": 1, "full_name": "Alex Chen", "role": "student", "headline": "Computer Science, Class of 2027" },
  "recipient": { "id": 7, "full_name": "Sarah Kim", "role": "alumni", "headline": "Senior Software Engineer at Brightline Cloud" },
  "proposed_time": "2026-11-18T15:00:00",
  "duration_minutes": 30,
  "message": "Hi Sarah, would you have 30 minutes for a coffee chat?",
  "response_note": "",
  "status": "pending",
  "direction": "outgoing",
  "created_at": "2026-11-15T01:16:47.858085"
}
// PATCH { "action": "accept", "note": "Happy to! Zoom works." } (by Sarah) → 200, status "accepted", response_note set
```

**Workflow and rules**

- The recipient accepts or declines a `pending` chat; the requester can cancel a `pending` chat; either side can cancel an `accepted` chat.
- `proposed_time` must be in the future and within 12 months (`422` otherwise).
- One pending request per requester/recipient pair (`409`). Alumni with `coffee_chat_available = false` can't be requested (`409`). Alumni↔alumni is rejected (`400`).
- No email or calendar invite is ever sent. A confirmed chat unlocks messaging between the two people.

## 9. Messaging (implemented)

One conversation per pair of users, **allowed once they have an accepted connection or a confirmed coffee chat** (team decision). Alumni↔alumni messaging is not supported.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/connections/messages` | Inbox: one thread per person, newest first, with `unread_count`, `can_message`, plus `total_unread` |
| GET | `/connections/messages/unread-count` | `{ "unread": n }` for a nav badge |
| GET | `/connections/messages/{user_id}` | Conversation (oldest → newest), `can_message`, `reason` if locked. **Marks incoming messages as read** |
| POST | `/connections/messages/{user_id}` | `{ "body": "..." }` (1–4000 chars) → `201` |

```json
// GET /connections/messages/7 → 200
{
  "other": { "id": 7, "full_name": "Sarah Kim", "role": "alumni", "headline": "Senior Software Engineer at Brightline Cloud" },
  "can_message": true,
  "reason": null,
  "items": [
    { "id": 6, "sender_id": 1, "recipient_id": 7, "body": "Thanks for accepting!",
      "created_at": "2026-11-15T01:16:47.880041", "read_at": null, "is_mine": true }
  ],
  "total": 1
}
// POST /connections/messages/8 before connecting → 403
// { "detail": "Connect or confirm a coffee chat with this person to start messaging" }
```

`read_at` on your own message is a read receipt.

## 10. AI features (implemented; work without an API key)

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/ai/status` | public | `{ "llm_configured": false, "fallback": "deterministic" }` |
| POST | `/ai/recommend-alumni` | student | Ranked alumni with score breakdown and explanation |
| POST | `/ai/generate-message` | student | Draft introduction message (never sent) |

```json
// POST /ai/recommend-alumni  { "limit": 1 } → 200 (abridged)
{
  "items": [{
    "alumni": { "user_id": 7, "full_name": "Sarah Kim", "...": "same shape as a directory card" },
    "match_score": 85,
    "breakdown": { "career_goal": 30.0, "skills": 15.0, "industry": 15.0, "job_title": 15.0, "background": 10.0 },
    "explanation": "Sarah Kim works as a Senior Software Engineer at Brightline Cloud, which lines up with your interest in ...",
    "shared_skills": ["Python", "Machine Learning"],
    "shared_interests": ["Machine Learning & AI", "Software Engineering"],
    "conversation_topics": ["What a typical week looks like as a Senior Software Engineer at Brightline Cloud", "..."],
    "explanation_source": "rules"
  }],
  "total": 1,
  "criteria": { "career_interests": ["..."], "target_roles": ["..."], "skills": ["..."] },
  "weights": { "career_goal": 30, "skills": 30, "industry": 15, "job_title": 15, "background": 10 },
  "disclaimer": "Match scores are a transparent weighted heuristic ..."
}
```

Request body (all optional): `career_interests`, `skills`, `target_roles` (override the saved profile), `limit` (1–20, default 6), `use_llm` (default `false`).

```json
// POST /ai/generate-message  { "alumni_id": 7, "purpose": "coffee_chat", "tone": "friendly" } → 200 (abridged)
{
  "subject": "USC student hoping to learn about your path",
  "message": "Hi Sarah,\n\nI'm Alex Chen, a USC Computer Science student (B.S.) interested in ...",
  "source": "template",
  "inputs_used": { "student_name": "Alex Chen", "alumni_company": "Brightline Cloud", "...": "..." },
  "notice": "Draft only — review and edit before using it. TrojanLink never sends messages automatically."
}
```

`purpose`: `coffee_chat` · `career_advice` · `industry_insight` · `application_advice` · `mentorship`. `tone`: `friendly` · `formal`. Optional `personal_note` (≤ 400). An external LLM is called only when `LLM_API_KEY` is set **and** the request sends `use_llm: true`; any failure falls back to the deterministic result.

> AI Resume Tailoring is **not** part of this implementation.

## 11. Errors and status codes

| Code | Meaning in this API | Example `detail` |
| --- | --- | --- |
| 400 | Not allowed by relationship rules | `"Connections must include at least one student"` |
| 401 | Missing, invalid, expired or forged token | `"Not authenticated"` |
| 403 | Wrong role, or not your action | `"This action requires the student role"` |
| 404 | Not found **or not visible to you** (e.g. a resume you may not see) | `"Resume not available"` |
| 405 | Method not allowed (e.g. `PUT /profiles/{other_id}`) | — |
| 409 | State conflict: duplicate, already answered, wrong state | `"Request is already accepted"` |
| 413 / 415 | Resume too large / not a PDF | `"Resume must be a PDF file"` |
| 422 | Validation error (FastAPI list form, below) or rule violation | `"Proposed time must be in the future"` |
| 500 | Unexpected error, always generic | `"Something went wrong on the server. Please try again."` |

```json
// 422 validation shape
{ "detail": [ { "type": "missing", "loc": ["body", "proposed_time"], "msg": "Field required", "input": { "recipient_id": 7 } } ] }
```

## 12. APIs expected by the team frontend (NOT implemented)

These calls exist in Jessica's `frontend/src/useBoard.ts` (team repository, `main` @ `87ea50b`). **Neither the Claude implementation nor the team backend serves them today.** Closest Claude equivalents are listed for adaptation.

| Expected call | Body the frontend sends | Response the frontend uses | Closest Claude API |
| --- | --- | --- | --- |
| `POST /connections/requests` | `{ id, kind: "connection", studentId, alumniId, purpose: "connection" \| "coffee", note, topic, availability, status, createdAt }` | The same object back (frontend `RequestItem`) | Same path, different body: `{ addressee_id, message }` |
| `PATCH /connections/requests/{id}/decision` | `{ status: "accepted" \| "interested" \| "declined" }` | Ignored (frontend updates locally) | `PATCH /connections/requests/{id}` with `{ action }` |
| `POST /messages` | `{ id, requestId, senderId, text, createdAt }` | A message object (`Message`) | `POST /connections/messages/{user_id}` with `{ body }` |
| `PATCH /persona/me` | The whole frontend `Person`: `name, email, program, year, company, title, location, bio, skills, experience, education, projects, openToConnect, coffeeChats, schedulingUrl, ...` | Ignored | `PUT /profiles/me` (different field names) |

Fields the frontend uses that the Claude implementation does **not** store: `location`, `education`, `projects`, `openToConnect`, `schedulingUrl`, coffee `topic` and `availability` (free text), and the `interested` status. See `API_COMPATIBILITY_MATRIX.md` for how to close each gap.
