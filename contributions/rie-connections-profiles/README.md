# Connections & Profiles — contribution by Rie (Applepan55)

A self-contained reference implementation of TrojanLink's **Connections** and **Profiles** modules, contributed for the team to review and reuse.

> **This folder is isolated.** Nothing outside `contributions/rie-connections-profiles/` was changed, and the team app in `backend/` and `frontend/` doesn't import anything from here. It runs as its own small app, with its own demo login and fictional data, so teammates can try every endpoint. Integration into the team modules happens later through normal Pull Requests (see [Integration guidance](#integration-guidance)).

**Backend only.** This contribution contains no frontend code; the team frontend in `frontend/` is the only UI. Some files in `docs/` still describe a reference demo UI and browser test from the original standalone project (`Applepan55/trojanlink-claude`); those are not part of this folder.

Built independently with Claude (Claude Code) and mirrored from `Applepan55/trojanlink-claude`, commit `31f60dc`. All people, companies, emails and resumes in the demo data are fictional; accounts are not USC-verified.

## What's inside

| Area | What works |
| --- | --- |
| Connections | Alumni directory search (company, industry, job title, skills, career interest, USC degree, graduation year), student discovery, connection requests (send, accept, decline, withdraw, remove) |
| Coffee chats | Request with date, time, length and message; accept, decline, cancel |
| Messaging | Unlocked by an accepted connection **or** a confirmed coffee chat. Inbox, unread count, read receipts |
| Profiles | Student and alumni profiles: academic and professional background, skills, interests, career goals; you can edit only your own |
| Privacy settings | Search visibility, email sharing, resume visibility |
| Resume (reference only) | Basic PDF upload/view/remove with visibility. The team's `/resumes` module remains the real resume system |
| AI (no API key needed) | Deterministic alumni recommendations with explanations; template introduction drafts |
| Quality | 84 backend tests (98% line coverage) |

Not included, by team decision: AI Resume Tailoring, Job Posts, seminars and video features.

## Architecture

```text
contributions/rie-connections-profiles/
├── backend/                  FastAPI + SQLAlchemy 2 + SQLite (standalone)
│   ├── app/
│   │   ├── models/           users*, student_profiles, alumni_profiles, connections, coffee_chats, messages*
│   │   ├── routers/          auth*, profiles, connections, messages, ai
│   │   ├── services/         presenters (privacy rules), recommendation, taxonomy, resumes, seed
│   │   └── security/         demo login: JWT + scrypt*
│   └── tests/                84 pytest tests
└── docs/                     API reference, compatibility matrix, integration guide, ...
```

`*` These pieces exist only so this folder runs on its own. **Don't copy them into the team app**: the team's login, `users` table and job-request `messages` table already exist (see [Integration guidance](#integration-guidance)).

## Run it (standalone, optional)

Requirements: Python 3.11+. Run everything from **inside this folder**; it uses its own database and ports.

```bash
cd contributions/rie-connections-profiles/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # set SECRET_KEY (demo password defaults to trojan-demo-2026)
python -m app.seed --reset           # fictional demo data
uvicorn app.main:app --port 8001     # 8001 so it doesn't clash with the team backend on 8000
pytest                               # 84 tests
```

Demo accounts: `alex.chen@student.example.com` (student) and `sarah.kim@alumni.example.com` (alum), with the password from `DEMO_USER_PASSWORD`. Swagger: <http://localhost:8001/docs>.

Run the team's tests from `backend/` (repo root) as usual. This folder's tests run only from `contributions/rie-connections-profiles/backend`.

## API endpoints (implemented here)

| Area | Endpoints |
| --- | --- |
| Profiles | `GET /profiles/me`, `PUT /profiles/me`, `GET /profiles/{user_id}` |
| Settings and resume | `GET`/`PUT /profiles/me/settings`, `PUT`/`DELETE /profiles/me/resume`, `GET /profiles/{user_id}/resume` |
| Discovery | `GET /connections/alumni`, `GET /connections/students` |
| Connection requests | `POST`/`GET /connections/requests`, `PATCH /connections/requests/{id}` (`accept`, `decline`, `withdraw`, `remove`) |
| Coffee chats | `POST`/`GET /connections/coffee-chats`, `PATCH /connections/coffee-chats/{id}` (`accept`, `decline`, `cancel`) |
| Messaging | `GET /connections/messages`, `GET /connections/messages/unread-count`, `GET`/`POST /connections/messages/{user_id}` |
| AI | `POST /ai/recommend-alumni`, `POST /ai/generate-message`, `GET /ai/status` |
| Demo login (don't port) | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |

Full request/response examples, data model, workflows and error codes: [`docs/CONNECTIONS_PROFILES_API.md`](docs/CONNECTIONS_PROFILES_API.md).

## Integration guidance

The team app reserves empty slots for this work: `backend/app/models_connections.py`, `routers/connections.py`, `seeds/connections.py`, and the same for `persona`. The frontend already calls `POST /connections/requests`, `PATCH /connections/requests/{id}/decision`, `POST /messages` and `PATCH /persona/me`, which no backend serves yet.

Recommended path:

1. **Port logic, not the whole app.** Copy the connection, coffee chat, messaging, privacy and recommendation logic into the team's reserved files. Use the team's `get_current_user`, `require_student`, `require_alumni` and `User` model.
2. **Avoid duplicates.** Don't port the demo login, the `users` table or the resume storage. Name the message table `connection_messages`, because `messages` is already used by job requests.
3. **Match Jessica's contract.** Accept the request bodies `frontend/src/useBoard.ts` sends; Jessica wires the remaining frontend calls.
4. **Small PRs:** Connections → Profiles/Persona → Coffee chats + messaging → frontend wiring.

Details: [`docs/API_COMPATIBILITY_MATRIX.md`](docs/API_COMPATIBILITY_MATRIX.md) (endpoint-by-endpoint fit, field mapping, naming conflicts) and [`docs/TEAM_INTEGRATION_GUIDE.md`](docs/TEAM_INTEGRATION_GUIDE.md) (PR plan, ownership, decisions still needed).

## Other docs in this folder

| File | Contents |
| --- | --- |
| `docs/STANDALONE_APP.md` | The original full README of the standalone app (demo script, accessibility, limitations) |
| `docs/architecture.md` | Layers, privacy rules, extension points |
| `docs/api-integration.md` | Earlier API guide for the standalone app |
| `docs/demo-data.md` | Fictional demo accounts and what each demonstrates |
| `docs/requirements-checklist.md` | Version 1 requirements checklist used to compare implementations |
