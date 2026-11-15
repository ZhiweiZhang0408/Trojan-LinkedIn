# Demo data

All people, companies, emails and resumes are **fictional**. Emails use the reserved `example.com` domain. Accounts are for local development only and are **not USC-verified**. Every account uses the password in `DEMO_USER_PASSWORD` (backend `.env`; the `.env.example` default is `trojan-demo-2026`).

The seed is **deterministic**: the same users, profiles, relationships and messages are created in the same order every time, so ids are stable. Dates are relative to the moment of seeding, so pending coffee chats are always in the near future.

```bash
cd backend
python -m app.seed --reset     # drop all tables and re-create the demo data
```

## Main demo accounts

| Id | Account | Email | Use it to show |
| --- | --- | --- | --- |
| 1 | **Alex Chen**, student, CS B.S. 2027 | `alex.chen@student.example.com` | The full student journey. He starts with 1 unread message (from Sofia), 1 incoming request (Mia → accept/decline), 1 outgoing request (→ David → **withdraw**), 1 connection (Sofia → **remove**), 1 declined coffee chat (Carlos, in history), and no resume (→ **upload**) |
| 7 | **Sarah Kim**, alumna, Senior SWE at Brightline Cloud | `sarah.kim@alumni.example.com` | The alumni side. Top AI match for software engineering, 1 pending coffee chat from Mia (accept/decline), receives Alex's request in the demo |

## Supporting accounts

| Id | Account | Role in the demo |
| --- | --- | --- |
| 2 | Priya Patel (student) | Connected to Marcus with a confirmed chat and a message thread. Resume visible to **connections** (Marcus can download it, Alex can't) |
| 3 | Jordan Rivera (student) | Film student, used in student search |
| 4 | Mia Nguyen (student) | Sends Alex a connection request and Sarah a coffee chat request. Resume visible to **everyone** |
| 5 | Ethan Brooks (student) | Finance student, used in recommendations when the interest is Finance |
| 6 | Sofia Martinez (student) | Connected to Alex, with a message thread |
| 8–18 | David Okafor, Emily Zhang, Marcus Johnson, Rachel Lee, Carlos Ramirez, Hannah Park, Kevin Tran, Olivia Bennett, Nathan Wright, Aisha Rahman, Daniel Cho (alumni) | Directory, filters and recommendations across tech, robotics, gaming, product, healthcare AI, finance, media, cybersecurity, design, consulting, fintech and clean energy. **Olivia Bennett** is not open to coffee chats (shows that state) |

## What exists after seeding

| Item | Count | States |
| --- | --- | --- |
| Students / alumni | 6 / 12 | All profiles complete (background, skills, interests, bio) |
| Connections | 4 | accepted ×2 (Sofia↔Alex, Priya↔Marcus), pending ×2 (Mia→Alex, Alex→David) |
| Coffee chats | 3 | accepted (Priya→Marcus), pending (Mia→Sarah), declined (Alex→Carlos) |
| Messages | 5 | Sofia↔Alex (1 unread for Alex), Priya↔Marcus (1 unread for Priya) |
| Resumes | 2 PDFs | Mia (`everyone`), Priya (`connections`). Generated text PDFs labelled "FICTIONAL DEMO RESUME" |

Seeding never runs twice: if the database already has users, startup skips it. `tests/test_seed.py` checks that two seeds produce identical data and that every state above exists.
