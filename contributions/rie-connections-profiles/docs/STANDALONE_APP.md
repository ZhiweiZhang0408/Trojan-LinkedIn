# TrojanLink AI

**Your USC Network. Your Next Opportunity.**

TrojanLink AI is a career networking prototype for the USC community, built for the AI@USC Hackathon 2026. Students find relevant alumni, see *why* each one is a good match, draft a personal introduction, request a coffee chat, and keep the conversation going with direct messages.

This repository is the **Claude Code implementation** of the team's **Connections + Profiles** scope, plus the authentication that supports it. It was built independently of the Codex and Antigravity versions so the three can be compared on the same requirements (see [docs/requirements-checklist.md](requirements-checklist.md)).

> **Note:** this is the original README of the standalone app, kept for reference inside the team contribution folder. Paths like `backend/` and `frontend/` below refer to `contributions/rie-connections-profiles/`.
>
> All people, companies, emails and resumes in the demo data are fictional. Accounts are self-registered and **not USC-verified**. This is not an official USC service.

**Version 1 scope.** Connections and Profiles, the two AI features that support them (alumni recommendations and introduction drafts), and basic resume management.
**Not in Version 1.** AI Resume Tailoring (an optional later enhancement), Job Posts (another teammate's module), seminars, alumni lectures, recorded videos and video archives. The code is structured so Job Posts and future AI agents can plug in: see [docs/architecture.md](architecture.md).

## Features

| Area | What works |
| --- | --- |
| Authentication | Register as a student or alum, log in and out, current user, JWT bearer tokens, scrypt password hashing, server-side role checks |
| Profiles | Student and alumni profiles with academic and professional background (students: major, degree, experience; alumni: degree, company, title, industry, experience), skills, interests and career goals. You can only edit your own profile |
| Resume management | Students upload, replace, view and remove a PDF resume (≤ 5 MB, validated as a real PDF) and can add a resume link. Visibility: only me, my connections, or anyone signed in |
| Profile settings | Show me in search, share my email with connections, resume visibility. Alumni also set "open to coffee chats" |
| Alumni discovery | Search by name, company, industry, job title, skills, career interest, USC degree and graduation year, with a coffee-chat-only filter. Cards show a short bio and a match score |
| Connections | Student↔student and student↔alumni requests: send, accept, decline, **withdraw**, and **remove** (with an in-app confirmation). The status is shown on cards, profiles and the Connections page |
| Coffee chats | Request with date, time, length and message; accept, decline or cancel. Status badges; no external email or calendar |
| Messages | Unlocked by an accepted connection **or** a confirmed coffee chat. Inbox, unread badge, read receipts, mobile layout. Removing a connection closes messaging (unless a confirmed chat exists) but keeps the history |
| AI recommendations | Deterministic weighted score (career goal 30, skills 30, industry 15, title 15, background 10) with a breakdown, explanation, shared interests and conversation topics. Optional LLM explanations, only with consent |
| AI introductions | A template draft built only from profile facts (never invents shared experiences). Edit it, copy it, or use it in a coffee chat request. Optional LLM polish, only with consent |

## Quick start

Requirements: Python 3.11+ and Node 20+.

### 1. Backend (FastAPI, port 8000)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # set SECRET_KEY; DEMO_USER_PASSWORD has a default
python -m app.seed --reset                             # fresh, deterministic demo data
uvicorn app.main:app --reload
```

- Swagger docs: <http://localhost:8000/docs>. Health check: <http://localhost:8000/health>
- On first start the database (`backend/trojanlink.db`) is created and seeded automatically if it's empty. `python -m app.seed --reset` restores the demo state at any time.

### 2. Frontend (React + TypeScript + Vite + Tailwind, port 5173)

```bash
cd frontend
cp .env.example .env.local        # VITE_API_BASE_URL and (optional) VITE_DEMO_PASSWORD
npm install
npm run dev                       # http://localhost:5173
npm run build                     # type-check + production build
```

### Demo accounts (fictional, local development only)

Password for every demo account: the `DEMO_USER_PASSWORD` in `backend/.env` (`.env.example` default: `trojan-demo-2026`). The login page's demo buttons fill in the email, and the password too if `VITE_DEMO_PASSWORD` is set.

| Role | Name | Email |
| --- | --- | --- |
| Student | Alex Chen (CS B.S., 2027) | `alex.chen@student.example.com` |
| Alumni | Sarah Kim (Senior SWE, Brightline Cloud) | `sarah.kim@alumni.example.com` |

[docs/demo-data.md](demo-data.md) lists all 18 accounts and which feature each one demonstrates.

## Demo script (about 5 minutes, fresh seed)

1. **Log in** as Alex Chen with the *Try a demo account* button. The Messages badge shows 1 unread message from Sofia.
2. **Profile.** Open *My Profile*, add **Software Engineering** to Career interests, write a line under *Experience*, and click **Save profile**. Under **Resume**, upload any PDF and set *Who can see my resume* to **My connections**.
3. **AI recommendations.** Click *See alumni recommended for you*. Sarah Kim is first, with a score breakdown, an explanation and suggested topics.
4. **Directory.** Switch to *Alumni directory* and filter by Company "Brightline" (2 results), then by USC degree "M.S.".
5. **AI introduction and coffee chat.** On Sarah's card click *Write an introduction*, then **Generate Introduction with AI**. Edit the draft, click **Use in coffee chat request**, pick a time and click **Send request**.
6. **Connections.** Open *Connections → Requests*: **Accept** Mia's request and **Withdraw** your request to David. Under *My network*, **Remove** Sofia and confirm.
7. **Privacy (optional).** In *My Profile → Profile settings*, untick *Show me in search*. Other students no longer find you; tick it again afterwards.
8. **Alumni side.** Log out and log in as **Sarah Kim**. In *Coffee Chats*, click **Accept** on Alex's request. Open Alex's profile: his resume is now downloadable because the chat is confirmed.
9. **Messaging.** Log back in as Alex. *Coffee Chats → Confirmed* shows Sarah. Click **Message** and send a note. As Sarah, the badge shows it; reply. Alex sees the reply and a "seen" receipt.

The scripted version of this journey is `frontend/e2e/demo-journey.mjs` (see *Frontend verification*).

## Testing

### Backend

```bash
cd backend
pytest                                                   # 84 tests
pip install coverage && coverage run --source=app -m pytest && coverage report
```

| Suite | Tests | Covers |
| --- | --- | --- |
| `test_auth.py` | 7 | registration, login, validation, hashing, token failures, logout |
| `test_profiles.py` | 7 | view and edit own profile, role-specific fields, validation, no editing others, email privacy |
| `test_resume_settings.py` | 9 | resume upload/replace/delete, PDF and size checks, visibility, settings, discoverability, service reuse |
| `test_connections.py` | 12 | alumni and student search, connection requests, coffee chat lifecycle and permissions |
| `test_connection_lifecycle.py` | 8 | withdraw, remove, re-connect, messaging after removal, conflict messages, foreign-key cascades |
| `test_messages.py` | 6 | messaging permission rule, inbox, unread counts, read receipts, validation, privacy |
| `test_ai.py` | 9 | recommendations, determinism, roles, message generation, no invented claims |
| `test_edge_cases.py` | 18 | expired/forged tokens, error paths, sorting, pagination, time zones, JSON 500s, health, LLM consent and fallback (mocked) |
| `test_seed.py` | 5 | deterministic seed, feature coverage of demo data, valid sample PDFs, reset command |
| `test_config.py` | 2 | `.env` loading, settings from environment, no fixed secret fallback |
| `test_demo_journey.py` | 1 | the full demo scenario end to end through the API |

Line coverage of `backend/app`: **98%** (Connections router 100%, Profiles 99%, Messages 98%).

### Frontend verification

`frontend/e2e/demo-journey.mjs` drives a real browser (Playwright) through the whole demo, then runs accessibility and mobile sweeps:

```bash
cd backend && python -m app.seed --reset && uvicorn app.main:app        # terminal 1 (fresh data!)
cd frontend && npm run dev                                              # terminal 2
cd frontend && npx playwright install chromium                          # once
DEMO_PASSWORD=trojan-demo-2026 npm run e2e                              # terminal 3
# optional: SCREENSHOTS=./e2e-shots  HEADED=1  BASE_URL=...  CHROME_PATH=...
```

It checks 16 steps:

- Login, profile edit, resume upload and visibility.
- Recommendations, directory filters and arrow-key tabs.
- AI introduction and coffee chat request, including keeping keyboard focus inside the dialog.
- Accept, withdraw and remove connections, and the hide-from-search setting.
- Alumna accepts the chat and downloads the resume; messaging both ways with a read receipt.
- Excluded routes, and the skip link.
- On all 11 pages at desktop width and at 390 px: accessible names on every control, exactly one `h1`, and no horizontal overflow.

It also fails on any browser console error.

## Accessibility and mobile

- A skip link to the main content. Focus moves to the page on navigation, and the tab title updates.
- Every control has an accessible name (checked automatically). Each page has exactly one `h1`.
- Dialogs keep keyboard focus inside, close with Esc, and return focus afterwards. Destructive actions use an in-app confirmation, never `window.confirm`.
- Tabs support ←/→/Home/End. Status changes are announced via `aria-live` toasts.
- Text colour pairs meet WCAG AA (4.5:1). The gold badge text was darkened to `#855706` (5.6:1).
- Responsive from 390 px. The sidebar becomes a top menu, and Messages switches between list and conversation. `prefers-reduced-motion` is respected.

## Architecture

```text
trojanlink-claude/
├── backend/
│   ├── app/
│   │   ├── main.py            # app factory, CORS, routers, JSON error handler, /health, startup seed
│   │   ├── config.py          # env-driven settings (no hardcoded secrets)
│   │   ├── database.py        # SQLAlchemy engine/session/Base (SQLite FK enforcement on)
│   │   ├── models/            # User, StudentProfile, AlumniProfile, Connection, CoffeeChat, Message
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── routers/           # auth, profiles (+resume, settings), connections, messages, ai
│   │   ├── services/          # presenters (privacy rules), resumes, recommendation, message_generator, llm, seed
│   │   └── security/          # scrypt hashing, JWT, auth + role dependencies
│   ├── tests/                 # pytest suite (84 tests)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── services/          # api.ts (REST client) + types.ts: reusable by another frontend
│   │   ├── hooks/             # auth context, hash router, async data, toasts
│   │   ├── components/        # UI kit, ScoreRing, AlumniCardView, ConnectButton, CoffeeChatModal, MessageGenerator, ConfirmDialog
│   │   └── pages/             # Login/Register, Dashboard, Discover, ProfileDetail, MyProfile, Connections, CoffeeChats, Messages
│   └── e2e/demo-journey.mjs   # browser verification script
└── docs/
    ├── api-integration.md     # endpoint reference and conventions (for Jessica's frontend)
    ├── architecture.md        # Version 1 scope, layers, privacy rules, extension points
    ├── demo-data.md           # demo accounts and what each demonstrates
    └── requirements-checklist.md  # Claude vs Codex vs Antigravity comparison
```

- **Swappable frontend.** All server access goes through `frontend/src/services/api.ts`. The backend contract is in `docs/api-integration.md`.
- **No native dependencies.** Hashing uses the standard library's `hashlib.scrypt`; routing is a tiny hash router.
- **Safe AI by default.** Deterministic scoring and templates work offline. The LLM is called only with an API key **and** explicit consent on each request.

## Security and privacy

- Passwords use salted scrypt. JWTs are signed with `SECRET_KEY` from the environment; expired, forged and unknown-user tokens are rejected.
- Role and relationship checks run on the server. Who can see an email, download a resume or send a message is decided in one module (`services/presenters.py`).
- Profile edits are only possible through `PUT /profiles/me`.
- Resumes are checked against the PDF signature, size-limited, stored under random server-side names, and served according to the owner's visibility setting.
- Pydantic validation is on every input. CORS is limited to `CORS_ORIGINS`. Unexpected errors return a generic JSON 500 with no internals.
- `.env` files and uploaded resumes are git-ignored. Demo credentials appear only in `.env.example` and are labelled fictional.
- Nothing is sent outside the app: no automatic email, calendar invites or forwarded messages.

## Known limitations

- There's no USC SSO or enrollment/alumni verification; accounts are self-reported.
- SQLite with `create_all` and no migrations yet. Add Alembic before sharing a database with Job Posts; upgrading from older local versions needs `python -m app.seed --reset`.
- JWT logout is client-side only: no token revocation or refresh tokens.
- Messages refresh by polling (8–20 s), not real-time. There are no email or push notifications, and no message attachments, editing or deleting.
- Times are local wall-clock time (no time zones); coffee chats have no reminders or calendar export.
- Resumes are stored on the local disk. A shared deployment needs object storage and malware scanning.
- Directory filtering runs in Python, which is fine for hundreds of profiles; move it to SQL or full-text search to scale.
- The recommender uses a small hand-written career taxonomy. It's explainable but doesn't learn.
- Jessica's `PRODUCT_PLAN.md` wasn't available to this implementation. Resume management and settings follow the team's scope messages and should be checked against her plan.
- `npm run build` (Vite) and `npm run e2e` were verified with equivalent tooling offline (esbuild + the Tailwind compiler, Playwright with system Chrome). Run them once on a networked machine.
