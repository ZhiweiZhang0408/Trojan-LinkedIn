# Team Integration Guide — Connections & Profiles

How the team can review and reuse the Connections & Profiles work from **`Applepan55/trojanlink-claude`** in the official repository **`ZhiweiZhang0408/Trojan-LinkedIn`**, through small Pull Requests, without overwriting existing functionality.

Companion docs: `CONNECTIONS_PROFILES_API.md` (what exists, with examples) · `API_COMPATIBILITY_MATRIX.md` (what fits, what changes).

## 1. In one minute

- The team repo already reserves **Connections** (`models_connections.py`, `routers/connections.py`, `seeds/connections.py`) and **Persona/Profiles** (`models_persona.py`, `routers/persona.py`, `seeds/persona.py`). They're empty today.
- Jessica's frontend already calls `POST /connections/requests`, `PATCH /connections/requests/{id}/decision`, `POST /messages` and `PATCH /persona/me`. **Nothing serves them yet.**
- The Claude implementation has working, tested backend logic for these features: 84 tests, but in a standalone app.
- Plan: port **code, not commits**, into the reserved files, in **4 small PRs**. Each PR uses the team's login, `User` table and resume system, and keeps every other module's files untouched.
- Not ported: the Claude login, its user table, its resume storage, its message writer and its React frontend. The team already has these, and porting them would create duplicates.

## 2. Access and how to explore the Claude implementation

- The Claude repository is **private**. Teammates can read it only if the owner adds them as collaborators on GitHub (Settings → Collaborators), or by reading these three docs.
- To run it locally: see the repository `README.md` (Quick start). Demo accounts are fictional (`alex.chen@student.example.com` / `sarah.kim@alumni.example.com`); Swagger is at `/docs`.
- The two codebases share **no git history**. Don't merge `trojanlink-claude` into the team repo: copy the relevant code into the team's files, as described below.

## 3. Who does what

| Area | Owner | Responsibility |
| --- | --- | --- |
| Connections backend (PR 1) | Connections owner (Applepan55) | Port connection requests and the directory into the reserved Connections files |
| Profiles / Persona backend (PR 2) | **To confirm** — the README lists Persona separately | Profile table, `/persona/me`, settings, recommendations |
| Coffee chats + messaging (PR 3) | Connections owner | Coffee chats, connection threads, unread counts |
| Frontend wiring (PR 4) | **Jessica** | Switch the frontend from sample data to the new endpoints; agree the contract |
| Login, `User` table, Resumes, Job Posts | Backend owner (Backend A) | Review PRs that read `User`; approve any shared-table decision |
| AI (`/ai/*`, tailoring, drafts) | AI owner | Optional: decide on a no-key fallback for `/ai/draft-message` |

## 4. Pull Request plan

Order follows the agreed priorities. Each PR is small, touches only its module's files, and is reviewable on its own.

```text
PR 1  Connections backend ──┬──► PR 3  Coffee chats + messaging ──┐
PR 2  Profiles / Persona ───┘                                     ├──► PR 4  Frontend wiring (Jessica)
                              (PR 2 also enriches PR 1's search) ─┘
```

### PR 1 — Connections backend APIs (first PR)

| | |
| --- | --- |
| Endpoints | `GET /connections/alumni` (filters on team `User`: name, company, title, major/degree, graduation year), `GET /connections/students`, `GET /connections/requests`, `POST /connections/requests` (**frontend body**), `PATCH /connections/requests/{id}/decision` (**frontend route**), `PATCH /connections/requests/{id}` (`withdraw`, `remove`) |
| Team files changed | `backend/app/models_connections.py`, `backend/app/routers/connections.py`, `backend/app/seeds/connections.py`, `backend/README.md` (new API section) |
| New files | `backend/app/connections_service.py` (privacy rules), `backend/tests/test_connections.py` |
| Ported from | `backend/app/routers/connections.py` (request + directory parts), `backend/app/services/presenters.py`, `backend/tests/test_connection_lifecycle.py`, parts of `test_connections.py` |
| Not changed | `models.py`, `security.py`, `config.py`, `main.py` (router already included), all other routers and seeds, `frontend/` |
| Acceptance | Team's 7 existing tests + new tests pass; `python -m app.seed` works; a test posts the **exact** frontend body and gets a `RequestItem`-shaped response; withdraw/remove rules tested |
| Reviewers | Backend owner (uses `User`), Jessica (contract) |
| Size | ~400–500 lines incl. tests |

### PR 2 — Profiles / Persona backend APIs

| | |
| --- | --- |
| Endpoints | `GET /persona/me`, `PATCH /persona/me` (frontend `Person` shape), `GET /persona/{user_id}`, `GET`/`PATCH /persona/me/settings` (search visibility, email sharing), `GET /connections/recommendations` (deterministic, no API key) |
| Team files changed | `backend/app/models_persona.py` (one `profiles` table), `backend/app/routers/persona.py`, `backend/app/seeds/persona.py`, `backend/README.md` |
| New files | `backend/app/recommendation.py` (+ career taxonomy), `backend/tests/test_persona.py`, `backend/tests/test_recommendations.py` |
| Ported from | `backend/app/routers/profiles.py` (profile + settings parts), `backend/app/schemas/profile.py`, `backend/app/services/recommendation.py`, `taxonomy.py`, tests |
| Profile fields | `bio`, `skills`, `career_interests`, `target_roles`, `experience`, `education`, `projects`, `location`, `open_to_connect`, `coffee_chats`, `scheduling_url`, `portfolio_url`, `discoverable`, `show_email_to_connections`. `company`, `title`, `major`, `grad_year` and `linkedin_url` stay on team `User` |
| Not ported | Claude resume upload/download (team `/resumes` is the resume system) |
| Acceptance | `PATCH /persona/me` accepts the exact frontend `Person` JSON; users can't edit others; privacy rules tested; directory filters by skills/interests once profiles exist |
| Reviewers | Persona owner (if someone else), backend owner, Jessica |
| Size | ~450–550 lines incl. tests |

### PR 3 — Coffee chat and messaging APIs

| | |
| --- | --- |
| Endpoints | Coffee invitations through `POST /connections/requests` with `purpose: "coffee"` (+ `topic`, `availability`, optional `proposed_time`), accept/decline/cancel; `GET`/`POST /connections/requests/{id}/messages`; `GET /connections/messages` (inbox), `GET /connections/messages/unread-count` |
| Team files changed | `backend/app/models_connections.py` (coffee fields; `ConnectionMessage` in table **`connection_messages`**), `backend/app/routers/connections.py`, `backend/app/seeds/connections.py`, `backend/README.md` |
| New files | `backend/tests/test_connection_messages.py` |
| Rules kept | Messaging opens after an accepted connection **or** a confirmed coffee chat; alumni↔alumni not supported; history stays readable after removal; sender always from the token |
| Must not | Touch the team's `messages` table or `/job-requests/*` threads |
| Reviewers | Backend owner (table naming), Jessica (thread contract) |
| Size | ~350–450 lines incl. tests |

### PR 4 — Frontend integration (Jessica, only where necessary)

- In API mode, load invitations, people and profiles from `GET /connections/requests`, `GET /connections/alumni` and `GET /persona/{id}` instead of sample data.
- Use the server-assigned request `id`. Post connection replies to `/connections/requests/{id}/messages` (one URL change from `POST /messages`).
- Optional: withdraw/remove buttons, unread badge, recommendations panel.
- No backend changes in this PR. The Claude React frontend is **not** ported; it's only a reference for flows.

### Optional, separate PRs (only if their owners agree)

- AI owner: a template fallback for `/ai/draft-message` when no API key is set (from Claude's `message_generator.py`).
- Backend owner: a database check in `/health`; SQLite foreign-key enforcement.

## 5. Porting recipe (for whoever writes PR 1–3)

1. Branch from the latest team `main` on a fork: `feature/connections-api`, then `feature/persona-api`, then `feature/connections-messaging`.
2. Copy the logic named in the PR table; then:
    - replace `from ..security import get_current_user, require_role` with the team's `get_current_user`, `require_student`, `require_alumni`;
    - read `company`, `title`, `major`, `grad_year`, `linkedin_url` from team `User`, the rest from `profiles`;
    - replace the Claude settings object with the team's `config.py` constants;
    - keep the `{ "detail": ... }` error format (both codebases already use it).
3. Seeds: use only the 6 shared users (`users["alex"]`, `users["maya"]`, …), add rows only, and never call `db.commit()` in a module seed.
4. Tests: log in with the team's seeded, verified users (password `password123`), or create verified users directly. Never use the Claude demo accounts.
5. Run `pytest -q` (all team tests too) and `python -m app.seed` before opening the PR.

## 6. Ground rules

- No PR edits another module's files (`models.py`, `auth.py`, `jobs.py`, `requests.py`, `resumes.py`, `ai*.py`, `seeds/core.py`, `frontend/`) without that owner's approval.
- No second login, user table, resume system or message system. One table name per concept: `connection_messages`, never `messages`.
- No new dependencies.
- Fictional demo data only.
- Out of scope: AI Resume Tailoring changes, Job Posts changes, seminars or video features.
- Everything goes through a PR into `main`; nobody pushes to `main` directly, and nobody merges their own PR.

## 7. Decisions to confirm before PR 1

| # | Question | Proposal |
| --- | --- | --- |
| 1 | Who owns Persona/Profiles? | Connections owner does PR 2 unless the Persona owner already started |
| 2 | Coffee chats: one invitation type (`purpose`) or a separate table? | One invitation with `purpose`, free-text `availability`, optional `proposed_time` |
| 3 | Connection thread path | `POST /connections/requests/{id}/messages` (instead of `POST /messages`) |
| 4 | Status `interested` for connections | Keep it as the frontend's "open to chat" answer; treat it like `accepted` for messaging (confirm) |
| 5 | Extra seeded alumni for better recommendations? | Ask the backend owner; otherwise use only the 6 shared users |
| 6 | Profile resume | Link to the student's confirmed base resume from team `/resumes`, only if `resume_visibility` allows |

## 8. Pull Request description (template for PR 1)

```markdown
## Connections API (PR 1 of 4): connection requests + alumni/student directory

Implements the Connections module in its reserved files, serving the calls Jessica's
frontend already makes. Logic is ported from the independently developed Claude
implementation (Applepan55/trojanlink-claude), adapted to this repo's login and User table.

### What's included
- `POST /connections/requests`: accepts the frontend's RequestItem body (connection invitations)
- `PATCH /connections/requests/{id}/decision`: alum answers (accepted / interested / declined)
- `PATCH /connections/requests/{id}`: withdraw (sender) / remove (either side)
- `GET /connections/requests`, `GET /connections/alumni`, `GET /connections/students`
- Demo connections among the 6 shared seed users; tests in `backend/tests/test_connections.py`

### What's NOT changed
- No changes to `models.py`, `security.py`, auth, Job Posts, Resumes, AI or `frontend/`
- No new tables besides `connections`; no new dependencies

### How to test
`pytest -q` (existing 7 tests + new ones) · `python -m app.seed` · Swagger at `/docs`

### Needs review from
- Backend owner: use of `User` fields and seeds
- Jessica: request/response shape matches `useBoard.ts`

Docs: CONNECTIONS_PROFILES_API.md and API_COMPATIBILITY_MATRIX.md (Claude implementation).
```

## 9. Checklist for every PR

- [ ] Only the module's own files changed (plus new tests and its README section)
- [ ] Team's existing tests still pass; new tests cover success, permission (403/404) and conflict (409) paths
- [ ] `python -m app.seed` runs; seed adds rows only, using the 6 shared users
- [ ] No duplicate login, user, resume or message tables; no table named `messages` added
- [ ] Request bodies match what `frontend/src/useBoard.ts` sends (or Jessica agreed to the change in the PR)
- [ ] No secrets, no real personal data, no new dependencies
