# Trojan Board frontend

Run `npm ci` and `npm run dev` from this directory. Open the local URL printed by Vite. `npm run build` checks types and produces the production build.

**Local Demo** opens by default. Use the account selector to switch between Alex (student), Maya (alum), and Jordan (alum). Open Arcwell's Data Analyst Intern posting, start a referral request, select or upload a resume, confirm it, and send the preview. Switch to Maya and open the request in Profile to review the submitted version and reply. Connections and demo activity persist in the current browser. PDF and DOCX files are read locally. Use a text-based PDF or a DOCX file with selectable text.

**Connected Workspace** is available via workspace settings. Enter the team's running FastAPI URL and sign in with a seeded account. Use the backend's allowed frontend origin when configuring CORS. The frontend uses the backend's login, jobs, resume versions, referral requests, statuses, and thread messages. Upload still reads the file in the browser. The backend saves the confirmed structured content. Original-file sharing in this mode is available for resumes that already have an original attached on the backend.

The [backend API reference](https://claude.ai/artifact/AJ8fSLKzYSwcqnC5ZxAoLD#c9f1c291-7c77) and [inspected backend revision](https://github.com/ZhiweiZhang0408/Trojan-LinkedIn/tree/42ea2aefa47510f8e7ceab5f9df66d57e8180553/backend) cover the connected operations above. The inspected backend did not expose standalone Profile updates, Connections, an original-file import endpoint, or live AI. Local Demo includes profile editing and invitations, and labels its resume suggestions and evidence comparison as rule-based previews.
