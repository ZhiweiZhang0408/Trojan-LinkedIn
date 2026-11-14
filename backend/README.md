# Alumni Referral Board — Backend (Auth + Job Posts + Referral Requests)

FastAPI + SQLAlchemy 2 + SQLite + JWT + 邮箱验证码

## 启动

```bash
cd backend
uv venv .venv --python 3.12 && uv pip install -p .venv/bin/python -r requirements.txt
cp .env.example .env                  # 按需修改（不改也能跑，默认 SQLite）
.venv/bin/python -m app.seed          # 清空并写入虚构 demo 数据
.venv/bin/uvicorn app.main:app --reload
```
服务启动时会自动建表。

打开 http://localhost:8000/docs → 右上角 **Authorize**（username 填邮箱）即可调试所有接口。
测试：`.venv/bin/python -m pytest -q`

Demo 账号（密码都是 `password123`）：
- 校友：`maya.chen@alumni.usc.edu`、`jordan.reyes@alumni.usc.edu`、`priya.nair@alumni.usc.edu`、`sam.okafor@example.com`（非 USC 邮箱，无 Verified 标记）
- 学生：`alex.kim@usc.edu`、`taylor.brooks@usc.edu`

## 鉴权：edu 邮箱验证码

```
注册 POST /auth/register ──► 邮箱收到 6 位码 ──► POST /auth/verify-email ──► 返回 token（已登录）
之后 POST /auth/login（邮箱+密码）；未验证的账号返回 403 {"detail": "email_not_verified"}
```
- 学生必须 `@usc.edu`；验证通过 + USC 域名 → `is_usc_verified=true`（前端显示 Verified Trojan）
- 验证码 10 分钟过期，最多试 5 次，重发冷却 60 秒；数据库里只存 HMAC hash
- 未验证的账号可以重新注册（覆盖资料并发新码），防止“验证码丢了账号卡死”
- **开发模式** `EMAIL_BACKEND=console`：不真发邮件，验证码打印在终端，且注册接口直接返回 `dev_code`，前端联调 / demo 很方便
- **真发邮件** `EMAIL_BACKEND=smtp`：建一个团队 Gmail，开两步验证后生成 App Password，填进 `.env`

## 鉴权约定（给前端 / 其他模块）

- 验证或登录后返回 `{access_token, token_type, user}`，之后所有请求带 `Authorization: Bearer <token>`
- 其他模块（connections / persona）复用鉴权：
  ```python
  from app.security import get_current_user, require_student, require_alumni
  @router.get("/x")
  def x(user = Depends(get_current_user)): ...
  ```
- 角色：`student` 必须用 `@usc.edu` 邮箱注册；`alumni` 可用任意邮箱，`@usc.edu` / `@alumni.usc.edu` 会标记 `is_usc_verified=true`

## API

| Method | Path | 谁能用 | 说明 |
|---|---|---|---|
| POST | `/auth/register` | 所有人 | JSON 注册，发送验证码（开发模式返回 `dev_code`） |
| POST | `/auth/verify-email` | 所有人 | `{email, code}`，成功返回 token |
| POST | `/auth/resend-code` | 所有人 | `{email}` 重发验证码 |
| POST | `/auth/login` | 所有人 | JSON `{email, password}` |
| POST | `/auth/token` | 所有人 | OAuth2 表单登录（Swagger 用） |
| GET | `/auth/me` | 已登录 | 当前用户 |
| GET | `/jobs` | 所有人 | 列表 + 筛选：`q, company, industry, location, job_type, work_mode, referral_available, include_closed, include_expired, sort=newest\|deadline, limit, offset` |
| GET | `/jobs/{id}` | 所有人 | 详情；学生登录时额外返回 `my_request_status` |
| GET | `/jobs/mine` | 校友 | 我发布的职位（含 `request_count` / `accepted_count`） |
| POST | `/jobs` | 校友 | 发布职位 |
| PATCH | `/jobs/{id}` | 发布者 | 修改 |
| POST | `/jobs/{id}/close?filled=true` | 发布者 | 关闭（pending 请求自动变 `closed`） |
| POST | `/jobs/{id}/reopen` | 发布者 | 重新开放 |
| DELETE | `/jobs/{id}` | 发布者 | 删除 |
| POST | `/jobs/{id}/referral-requests` | 学生 | **multipart/form-data**：`note`(≥20 字)、`profile_link`、`resume`(pdf/doc/docx ≤5MB) |
| GET | `/referral-requests/sent` | 学生 | 我发出的请求 |
| GET | `/referral-requests/received?job_id=&status_filter=` | 校友 | 收到的请求 inbox |
| GET | `/referral-requests/{id}` | 双方 | 详情 |
| PATCH | `/referral-requests/{id}/decision` | 发布者 | `{status: accepted\|declined, alumni_response}` |
| POST | `/referral-requests/{id}/withdraw` | 学生 | 撤回 pending 请求 |
| GET | `/referral-requests/{id}/resume` | 双方 | 下载简历 |

前端上传简历示例：
```js
const fd = new FormData();
fd.append("note", note);
fd.append("resume", fileInput.files[0]);
await fetch(`${API}/jobs/${id}/referral-requests`, {
  method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
});
```

## 状态

- Job：`open` → `filled` / `closed`；`deadline` 过了自动 `is_expired=true`，默认不在列表显示
- Referral request：`pending` → `accepted` / `declined` / `withdrawn` / `closed`
- 每个职位详情都带 `referral_disclaimer`（"内推不保证面试或 offer"），前端直接展示即可

## 数据库 & 分工

SQLite，数据库文件不进 git。**大家只同步代码**：表结构写在 models 文件里，demo 数据写在 seeds 里。
每次 `git pull` 后运行 `.venv/bin/python -m app.seed`，所有人的本地数据就一致了（会清空本地数据）。

| 模块 | 负责人改的文件 |
|---|---|
| Auth + Job Post + Referral | `app/models.py`、`app/routers/{auth,jobs,referrals}.py`、`app/seeds/core.py` |
| Connections | `app/models_connections.py`、`app/routers/connections.py`、`app/seeds/connections.py` |
| Persona | `app/models_persona.py`、`app/routers/persona.py`、`app/seeds/persona.py` |

- 所有模块共用 `seeds/core.py` 里的 6 个 demo 用户（`users["alex"]`、`users["maya"]` …），不要另造用户
- 想要 demo 数据就写进自己的 seed 文件，不要只在本地手动加
- 要改 `User` 表先打招呼；persona 建议用单独的 `profiles` 表
- Demo 当天：一台电脑跑 `uvicorn app.main:app --host 0.0.0.0`，所有前端连这台的局域网 IP

## 已知 TODO（MVP 之后）

- 登录接口加限流
