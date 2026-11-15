# TrojanLink frontend

Run `npm ci` and `npm run dev` from this directory. Open the local URL printed by Vite. `npm run build` checks types and produces the production build.

The app opens with sample data. The account selector switches between Alex (student), Maya (alum), and Jordan (alum). Open Arcwell's Data Analyst Intern posting, start a referral request, select or upload a resume, confirm it, and submit. Switch to Maya and open the request in Profile to review the submitted version and reply. Sample data is stored in the current browser.

For backend integration, start the team's local FastAPI service. The app uses `VITE_API_BASE_URL` or `http://localhost:8000`. To open workspace settings for development, add `?workspace=settings` to the URL and select the settings icon. This lets you point the app at another running instance or switch the data source. The sign-in, registration, verification, and resend pages use the auth API. In backend console mode, the verification form pre-fills the code the backend returns.

The connected frontend supports jobs, PDF/DOCX import, resume confirmation and versions, original attachments, referrals, request statuses, and thread messages. AI tailoring (`POST /resumes/{id}/tailor`) and alumni review (`POST /ai/request-review`) use the backend's Claude integration. AI message drafts for referrals, questions, connection invites, and replies call `POST /ai/draft-message`. Any resume version can be exported as a PDF in the browser.

Profiles (`/persona/*`) and Connections (`/connections/*`: alumni directory, connection and coffee chat invitations, decisions, and messages) are served by the backend too. A student's profile falls back to their confirmed base resume for any field they haven't filled in.

For hosting, `scripts/replit-build.sh` builds this app with `VITE_HOSTED=true`: it then talks to the origin that serves it (`backend/serve.py`), starts in connected mode, and the sign-in page's demo accounts log in to the seeded users.
