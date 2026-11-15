# TrojanLink AI: Version 1 requirements checklist

Use one checklist to compare the three independent implementations (**Claude**, **Codex**, **Antigravity**) against the same finalized scope: **Connections + Profiles**, the authentication that supports them, and the two existing AI features. AI Resume Tailoring, Job Posts, seminars, lectures, recorded videos and video archives are **excluded**.

**How to use:** for each implementation, start from a freshly seeded database, follow "How to verify", and mark ✅ (works), ⚠️ (partial, add a note) or ❌ (missing). The Claude column is filled in with evidence. Codex and Antigravity are left for their reviewers.

Legend for Claude evidence: **API** endpoint · **UI** screen · **T** automated test (`backend/tests/…`) · **E2E** step in `frontend/e2e/demo-journey.mjs`.

## 1. Connections

| ID | Requirement | How to verify | Claude | Evidence (Claude) | Codex | Antigravity |
| --- | --- | --- | --- | --- | --- | --- |
| C-1 | Search alumni by company | Filter "Brightline" → 2 results | ✅ | API `GET /connections/alumni?company=` · UI Discover → Alumni directory · T `test_alumni_search_filters` · E2E | | |
| C-2 | …by industry, job title, skills, career interests | Filter each field | ✅ | same endpoint (`industry`, `title`, `skill`, `interest`) · T `test_alumni_search_filters` | | |
| C-3 | …by USC degree and graduation year | Filter "M.S." → 2; year 2018 → Sarah | ✅ | `degree`, `graduation_year` · T `test_student_experience_and_directory_filters` · E2E | | |
| C-4 | Alumni result shows name, position, company, USC background, skills, short bio, profile link, coffee chat button | Inspect a directory card | ✅ | UI `AlumniCardView` | | |
| C-5 | View an alum's full profile (expertise, company, background) | Open Sarah Kim | ✅ | API `GET /profiles/{id}` · UI profile page · T `test_view_other_profile_hides_email` | | |
| C-6 | Discover students with similar interests | Connections → Find students | ✅ | API `GET /connections/students` · T `test_student_discovery`, `test_student_search_filters` | | |
| C-7 | Send a connection request | Connect from a profile or card | ✅ | API `POST /connections/requests` · T `test_connection_request_flow` | | |
| C-8 | Accept / decline incoming requests | Alex accepts Mia | ✅ | API `PATCH …/requests/{id}` · T `test_connection_request_flow` · E2E | | |
| C-9 | **Withdraw** a sent request | Alex withdraws David | ✅ | `action: withdraw` · T `test_withdraw_pending_request` · E2E | | |
| C-10 | **Remove** an existing connection (with confirmation) | Alex removes Sofia | ✅ | `action: remove` + in-app confirm dialog · T `test_remove_accepted_connection_by_either_side` · E2E | | |
| C-11 | Connection status visible everywhere (none / pending / connected) | Cards, profile and Connections tabs agree | ✅ | `connection_status`, `connection_id` · T `test_declined_request_clears_status_and_allows_retry` | | |
| C-12 | Request a coffee chat with date, time, length and message | Request from Sarah's profile | ✅ | API `POST /connections/coffee-chats` · T `test_coffee_chat_request_and_accept` · E2E | | |
| C-13 | Recipient accepts / declines; requester cancels; status shown (pending/accepted/declined/cancelled) | Sarah accepts; check both sides | ✅ | API `PATCH …/coffee-chats/{id}` · T `test_coffee_chat_decline_and_cancel` · E2E | | |
| C-14 | Coffee chat validation (no past/far-future times, no duplicates, alum availability) | Try invalid requests | ✅ | T `test_coffee_chat_validation`, `test_coffee_chat_too_far_ahead` | | |
| C-15 | Basic messaging when **connected OR coffee chat confirmed** | Message after Sarah accepts | ✅ | API `/connections/messages…` · T `test_messaging_requires_connection_or_confirmed_chat` · E2E | | |
| C-16 | Messaging is blocked without a connection or confirmed chat, and closes on removal (history kept) | Try before trust; remove | ✅ | T `test_remove_accepted_connection_by_either_side` | | |
| C-17 | Inbox, unread count, read receipts | Badge + "seen" | ✅ | T `test_inbox_unread_and_read_receipts` · E2E | | |
| C-18 | No external email, calendar invites or auto-sent messages | Code review | ✅ | No outbound mail code. AI drafts are never sent | | |

## 2. Profiles

| ID | Requirement | How to verify | Claude | Evidence (Claude) | Codex | Antigravity |
| --- | --- | --- | --- | --- | --- | --- |
| P-1 | Student profile: name, email, major, degree program, graduation year, skills, interests, target roles, bio, resume/portfolio/LinkedIn URLs | My Profile as Alex | ✅ | API `GET/PUT /profiles/me` · T `test_student_edits_own_profile` | | |
| P-2 | Alumni profile: degree, year, company, title, industry, experience, skills, bio, LinkedIn, coffee chat availability | My Profile as Sarah | ✅ | T `test_alumni_edits_own_profile` | | |
| P-3 | Academic **and** professional background for both roles | Student "Experience" field | ✅ | shared `experience` field · T `test_student_experience_and_directory_filters` | | |
| P-4 | Profile created at registration and editable | Register a new user | ✅ | T `test_new_user_gets_empty_profile_and_default_headline` | | |
| P-5 | Users cannot edit other users' profiles | `PUT /profiles/{otherId}` | ✅ | no such route (405) · T `test_cannot_edit_another_users_profile` | | |
| P-6 | Input validation (URLs, years, lengths, role-specific fields) | Submit bad values | ✅ | T `test_profile_validation` | | |
| P-7 | Resume upload (PDF only, size limit) | Upload a PDF / a non-PDF | ✅ | API `PUT /profiles/me/resume` · T `test_resume_validation` · E2E | | |
| P-8 | Resume replace, view and remove | My Profile → Resume | ✅ | T `test_upload_view_replace_delete_resume` | | |
| P-9 | Resume visibility: only me / connections / everyone | Settings + download as others | ✅ | T `test_resume_visibility_rules`, `test_sample_resumes_are_valid_pdfs_with_visibility` · E2E | | |
| P-10 | Setting: search visibility | Toggle off → hidden from search and recommendations | ✅ | T `test_discoverable_hides_from_search_and_recommendations` · E2E | | |
| P-11 | Setting: email sharing | Toggle off → email hidden from connections | ✅ | T `test_show_email_setting` | | |

## 3. Authentication (only what Connections and Profiles need)

| ID | Requirement | How to verify | Claude | Evidence (Claude) | Codex | Antigravity |
| --- | --- | --- | --- | --- | --- | --- |
| A-1 | Register as student or alum; login; logout; current user | Swagger or UI | ✅ | `/auth/*` · T `test_auth.py` | | |
| A-2 | Secure password hashing; JWT; expired, forged and unknown tokens rejected | Tests | ✅ | scrypt + HS256 · T `test_expired_and_orphaned_tokens_are_rejected` | | |
| A-3 | Role-based permissions on the server | Alum calls a student-only route → 403 | ✅ | `require_role` · T in several suites | | |
| A-4 | No claim of USC verification | Read the UI copy | ✅ | Login/Register notes; "demo" badge | | |

## 4. AI features (kept by team decision)

| ID | Requirement | How to verify | Claude | Evidence (Claude) | Codex | Antigravity |
| --- | --- | --- | --- | --- | --- | --- |
| AI-1 | Alumni recommendations with score, explanation, shared interests and topics | Alex + Software Engineering → Sarah first | ✅ | API `POST /ai/recommend-alumni` · T `test_ai.py` · E2E | | |
| AI-2 | Score is a heuristic, not presented as a probability | Read the disclaimer | ✅ | response `disclaimer`, UI note | | |
| AI-3 | Introduction message writer: generate, edit, copy, use in a coffee chat request | Profile → Generate | ✅ | API `POST /ai/generate-message` · E2E | | |
| AI-4 | Never invents shared experiences | Tests | ✅ | T `test_template_never_invents_shared_experience` | | |
| AI-5 | Works with no API key; external LLM only with key **and** per-request consent; graceful fallback | Tests with a mocked provider | ✅ | T `test_llm_only_called_with_key_and_explicit_consent` | | |

## 5. Exclusions (must NOT be present)

| ID | Excluded item | How to verify | Claude | Codex | Antigravity |
| --- | --- | --- | --- | --- | --- |
| X-1 | AI Resume Tailoring (JD analysis, action verbs, tailored drafts) | Search code and UI | ✅ absent | | |
| X-2 | Job Posts module (business logic) | Search code and UI | ✅ absent (extension points only) | | |
| X-3 | Seminars, alumni lectures, recorded videos, video archives | Nav, routes, API | ✅ absent · T `test_seminar_endpoints_removed` · E2E | | |

## 6. Quality, integration and documentation

| ID | Requirement | How to verify | Claude | Evidence (Claude) | Codex | Antigravity |
| --- | --- | --- | --- | --- | --- | --- |
| Q-1 | Deterministic, fictional demo data covering every feature | `python -m app.seed --reset` twice | ✅ | T `test_seed_is_deterministic`, `test_seed_covers_every_feature` · `docs/demo-data.md` | | |
| Q-2 | Automated backend tests | Run suite | ✅ | **84 passed** | | |
| Q-3 | Backend line coverage | `coverage report` | ✅ | **98%** (Connections router 100%) | | |
| Q-4 | Frontend ↔ backend integration verified in a browser | Run the e2e script | ✅ | **16/16 steps**, 0 browser errors | | |
| Q-5 | Mobile responsive (390 px, no horizontal scroll) | e2e mobile sweep | ✅ | 11 pages | | |
| Q-6 | Accessibility basics: labelled controls, one h1 per page, keyboard focus in dialogs, skip link, WCAG AA contrast | e2e a11y sweep + contrast check | ✅ | see README "Accessibility" | | |
| Q-7 | Consistent API errors (`{detail}`), JSON 500s, health check | Tests | ✅ | T `test_unexpected_errors_return_json_500`, `test_health_checks_database` | | |
| Q-8 | Swagger docs at `/docs` | Open it | ✅ | FastAPI | | |
| Q-9 | English README, API guide, architecture doc | Read | ✅ | `README.md`, `docs/*.md` | | |
| Q-10 | Extensible for Job Posts and AI agents (not implemented) | Read the architecture doc | ✅ | `docs/architecture.md`, `services/resumes.py` | | |
| Q-11 | No secrets committed; demo credentials clearly fictional | Secret scan | ✅ | `.env` git-ignored; `.env.example` only | | |

## 7. Comparison metrics (fill in per implementation)

| Metric | Claude | Codex | Antigravity |
| --- | --- | --- | --- |
| Required items ✅ (sections 1–4, 38 items) | 38 / 38 | | |
| Exclusions respected (section 5) | 3 / 3 | | |
| Backend tests passing | 84 / 84 | | |
| Backend line coverage | 98% | | |
| Browser e2e steps passing | 16 / 16 | | |
| Commands from clone to running demo | 9 (README Quick start: 6 backend, 3 frontend) | | |
| Known limitations (count, severity) | see README | | |
| Notable design choices | deterministic AI + consented LLM; privacy rules centralized in one module | | |
