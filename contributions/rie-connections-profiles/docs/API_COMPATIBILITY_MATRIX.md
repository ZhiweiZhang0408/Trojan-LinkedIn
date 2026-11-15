# API Compatibility Matrix — Claude implementation vs. team repository

Compares the Connections & Profiles APIs in **`Applepan55/trojanlink-claude`** (commit `1254d56`) with the official team repository **`ZhiweiZhang0408/Trojan-LinkedIn`** (`main` @ `87ea50b`, reviewed read-only on 2026-11-14): its backend, and the calls Jessica's frontend already makes (`frontend/src/useBoard.ts`).

Endpoint details and examples: `CONNECTIONS_PROFILES_API.md`. Integration steps: `TEAM_INTEGRATION_GUIDE.md`.

## Verdict legend

| Verdict | Meaning |
| --- | --- |
| **Reuse** | Logic and URL fit the team's reserved module. Only mechanical changes: use the team's auth dependencies and `User` model |
| **Adapt** | Useful logic, but the request/response shape, data model or path must change to fit the team contract |
| **Missing** | Called by the team frontend; implemented **nowhere** yet (neither Claude nor team backend) |
| **Do not port** | The team already has its own version; porting would create a duplicate system |

## 1. Endpoint matrix

| # | Claude endpoint | Team backend today | Team frontend calls | Verdict | Work needed | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | ✅ Own login with email verification | `/auth/*` (team version) | **Do not port** | Use team login | Login |
| 2 | `GET /profiles/me` | ❌ (`/persona` is a placeholder) | — (frontend builds the profile from `/auth/me` + resume) | **Adapt** | Serve at `GET /persona/me`; frontend `Person` field names | Login (`User`) |
| 3 | `PUT /profiles/me` | ❌ | `PATCH /persona/me` with the whole `Person` | **Adapt** | Path, method and field names; add missing fields (§3) | Login (`User`) |
| 4 | `GET /profiles/{user_id}` | ❌ | — | **Adapt** | Serve at `GET /persona/{user_id}`; same privacy rules | Login |
| 5 | `GET`/`PUT /profiles/me/settings` | ❌ | — | **Adapt** | Store settings on the profile table, not `users` | — |
| 6 | `PUT`/`DELETE /profiles/me/resume`, `GET /profiles/{id}/resume` | ✅ Full resume system at `/resumes` (upload PDF/DOCX, versions, sharing per job request) | `/resumes/*` (team version) | **Do not port** | Reuse team resumes; at most a profile link to the student's confirmed base resume, gated by `resume_visibility` | Resume |
| 7 | `GET /connections/alumni` (search + filters + match score) | ❌ (placeholder) | — (frontend filters people it already loaded) | **Reuse** | Read `company`/`title`/`grad_year` from team `User`, the rest from the profile table | Login, Profiles |
| 8 | `GET /connections/students` | ❌ | — | **Reuse** | Same as #7 | Login, Profiles |
| 9 | `GET /connections/requests` | ❌ | — (frontend has no list call yet) | **Adapt** | Return frontend `RequestItem` shape (§4) | — |
| 10 | `POST /connections/requests` | ❌ | ✅ `POST /connections/requests` | **Adapt** | Accept the frontend body (`alumniId`, `purpose`, `note`, `topic`, `availability`); ignore client `studentId`/`id`/`status`; return `RequestItem` | Coffee chats (#13) |
| 11 | `PATCH /connections/requests/{id}` `{action: accept\|decline}` | ❌ | ✅ `PATCH /connections/requests/{id}/decision` `{status}` | **Missing** (path) / **Adapt** (logic) | Add the `/decision` route mapping `accepted`/`declined`/`interested` onto the existing rules | — |
| 12 | `PATCH /connections/requests/{id}` `{action: withdraw\|remove}` | ❌ | — | **Reuse** | Keep as is; Jessica can add buttons later | — |
| 13 | `POST`/`GET`/`PATCH /connections/coffee-chats` | ❌ | — (coffee is `purpose: "coffee"` on a connection invitation) | **Adapt** | Either serve coffee through #10, or keep this route and store `topic` + free-text `availability` with an optional `proposed_time` (team decision) | — |
| 14 | `GET /connections/messages` (inbox), `GET /connections/messages/unread-count` | ❌ | — | **Reuse** | Rename table (§5) | Job Posts (table name) |
| 15 | `GET /connections/messages/{user_id}` | ❌ | — | **Adapt** | Frontend threads are per **request** (`requestId`), Claude's per **pair**; add a request-scoped read | — |
| 16 | `POST /connections/messages/{user_id}` | ❌ | ✅ `POST /messages` `{requestId, senderId, text}` | **Missing** (path) / **Adapt** (logic) | Prefer `POST /connections/requests/{id}/messages` (Jessica changes one URL); sender from token, never body | Job Posts (path, table) |
| 17 | `POST /ai/recommend-alumni` | ❌ | — | **Adapt** (path) | Serve at `GET`/`POST /connections/recommendations` to stay out of the AI owner's `/ai` namespace; no API key needed | Profiles |
| 18 | `POST /ai/generate-message` | ✅ `POST /ai/draft-message` (kinds incl. `connection`, `coffee`; Claude API, 503 without key) | `/ai/draft-message` | **Do not port** | Optionally offer the template as a no-key fallback inside the AI owner's endpoint, with their approval | AI |
| 19 | `GET /ai/status` | ❌ | — | **Do not port** | Team AI owner decides | AI |
| 20 | `GET /health` (checks DB) | ✅ `GET /health` (no DB check) | — | **Do not port** | Optional suggestion to the backend owner | — |

**Totals (20 rows):** Reuse 4 (#7, #8, #12, #14) · Adapt 9 (#2–5, #9, #10, #13, #15, #17) · Missing path with adaptable logic 2 (#11, #16) · Do not port 5 (#1, #6, #18–20).

## 2. Endpoints the team frontend expects that nobody serves yet

| Frontend call (`useBoard.ts`) | Purpose | Build it from |
| --- | --- | --- |
| `POST /connections/requests` | Send a connection or coffee invitation | Matrix #10 + #13 |
| `PATCH /connections/requests/{id}/decision` | Alum answers an invitation | Matrix #11 |
| `POST /messages` | Reply in a connection thread | Matrix #16 (recommend renaming the path) |
| `PATCH /persona/me` | Save the profile | Matrix #3 |

The frontend README also notes that in API mode it has **no list calls** for invitations, people or profiles: connection invitations work "with sample data only". Loading them from the backend needs new frontend calls (Jessica): `GET /connections/requests`, `GET /connections/alumni`, `GET /persona/{id}`, and a thread read.

## 3. Profile field mapping (frontend `Person` ↔ Claude profile)

| Frontend `Person` | Team backend today | Claude implementation | Gap |
| --- | --- | --- | --- |
| `id` (string) | `users.id` | `user_id` (int) | Convert to string |
| `name` | `users.full_name` | `full_name` | — |
| `role` | `users.role` | `role` | — |
| `email` | `users.email` | `email` (null unless allowed) | Privacy rule kept |
| `program` | `users.major` | `student.major` / `alumni.usc_degree` | Single source: team `User` |
| `year` | `users.grad_year` | `graduation_year` | Single source: team `User` |
| `company`, `title` | `users.company`, `users.title` | `alumni.current_company`, `current_title` | Single source: team `User` |
| `bio`, `skills`, `experience` | ❌ | ✅ | Port |
| `location` | ❌ | ❌ | **New field** |
| `education`, `projects` | ❌ | ❌ (students have `degree_program`) | **New fields** |
| `openToConnect` | ❌ | ❌ | **New field** (accepting connection invitations) |
| `coffeeChats` | ❌ | `alumni.coffee_chat_available` | Rename |
| `schedulingUrl` | ❌ | ❌ | **New field** |
| — | — | `career_interests`, `target_roles`, `portfolio_url` | Claude extras (needed by recommendations) |
| — | `users.linkedin_url` | `linkedin_url` | Single source: team `User` |
| — | — | `discoverable`, `show_email_to_connections`, `resume_visibility` | Claude privacy settings; move to profile table |

## 4. Connection request mapping (frontend `RequestItem` ↔ Claude)

| Frontend field | Claude equivalent | Gap |
| --- | --- | --- |
| `id` (client-generated uid) | server `id` | Server assigns; frontend must use the returned id |
| `kind: "connection"` | — | Constant |
| `studentId`, `alumniId` | `requester_id`, `addressee_id` | Sender from token; Claude also allows student↔student |
| `purpose: "connection"` | `connections` row | — |
| `purpose: "coffee"` | `coffee_chats` row | Two tables vs one item: decide (matrix #13) |
| `note` | `message` | Rename |
| `topic`, `availability` (free text) | ❌ (coffee has `proposed_time`, `duration_minutes`) | **New fields** |
| `status: pending · accepted · declined` | ✅ same words | — |
| `status: interested` | ❌ | Add, or map to `accepted` (Jessica) |
| `status: withdrawn` | ✅ | — |
| — | `removed` | Claude extra |
| `createdAt` | `created_at` | camelCase response, or map in `lib/api.ts` |

Message mapping: frontend `{id, requestId, senderId, text, createdAt}` ↔ Claude `{id, sender_id, recipient_id, body, created_at, read_at, is_mine}`. Threads are keyed by request in the frontend and by user pair in Claude. Either is fine if one accepted request exists per pair; the team should pick one.

## 5. Database naming conflicts

| Claude table / column | Team repository | Risk | Resolution |
| --- | --- | --- | --- |
| `users` (own table) | `users` owned by the team login | **High**: duplicate user system | Don't create; reference team `users.id` |
| `users.discoverable`, `users.show_email_to_connections` | Team README: "check in before changing the `User` table" | Medium | Move to the profile table |
| `messages` | `messages` = job-request thread replies | **High**: table collision | Rename to `connection_messages` |
| `student_profiles`, `alumni_profiles` | README asks for one `profiles` table | Medium | One `profiles` table, role-specific fields nullable |
| `student_profiles.resume_*` columns | `resumes` table with versions and files | Medium: second resume system | Drop; use team resumes |
| `connections` | Reserved placeholder (`models_connections.py`) | None | Port |
| `coffee_chats` | Not present | None | Port (or merge into connections; matrix #13) |

## 6. Authentication integration requirements

- Import `get_current_user`, `require_student`, `require_alumni` from the team's `app.security`. Claude's `require_role(*roles)` accepts several roles; the team's takes one role. No Claude route needs several roles at once.
- Tokens are compatible: both are HS256 JWTs with `sub` = user id and `role`. The team signs with its own `SECRET_KEY`; nothing to share.
- Team login requires a verified email and `@usc.edu` for students. Port tests must log in with the team's seeded, verified users (`alex.kim@usc.edu`, `maya.chen@alumni.usc.edu`, … password `password123`) or create verified users directly in the database.
- The team's 401 message is `"Invalid or expired token"` (Claude: `"Not authenticated"`). Frontends should rely on the status code, not the text.
- Never trust ids sent in a body (`studentId`, `senderId`). Use the authenticated user. The Claude code already does this.

## 7. Dependencies on other team modules

| Team module (owner) | What Connections & Profiles needs from it | What it must not change |
| --- | --- | --- |
| Login (backend owner) | `User` model, `get_current_user`, role guards, seeded users | No new columns on `users` without agreement |
| Resumes (backend owner) | Optional: link a profile to the student's confirmed base resume | No second upload/storage path |
| Job Posts (backend owner) | Nothing functional; the shared name `messages` and the status word `interested` | Keep `/job-requests` threads separate from connection threads |
| AI (AI owner) | Optional: template fallback for `/ai/draft-message` | No changes to `/ai/*` without the AI owner; AI Resume Tailoring untouched |
| Frontend (Jessica) | Adopts the agreed contract; adds list/load calls | Backend PRs never edit `frontend/` |

## 8. Python and frontend dependencies

The ported backend code needs **no new packages**. FastAPI, SQLAlchemy 2, Pydantic 2, PyJWT and python-multipart are already in the team's `requirements.txt`. Claude-only helpers that would need nothing new either way (the scrypt hashing and the `.env` loader) are not ported. There are no frontend dependency changes.
