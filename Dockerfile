# One container serving the API and the built frontend on a single origin (Render, Hugging Face, etc.).
# Local development keeps using `uvicorn app.main:app` plus the Vite dev server.

# --- Stage 1: build the frontend ---
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Hosted build: talk to its own origin and start connected to the API (not sample mode).
# Demo accounts on the sign-in page log in to the seeded (fictional) users.
ARG DEMO_PASSWORD=password123
RUN VITE_HOSTED=true VITE_DEMO_PASSWORD="$DEMO_PASSWORD" npm run build

# --- Stage 2: Python runtime ---
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# serve.py looks for ../frontend/dist
COPY --from=frontend /app/frontend/dist /app/frontend/dist

EXPOSE 8000
# Seed fictional demo data on first start (the disk is wiped on every redeploy/restart).
CMD ["sh", "-c", "[ -f referral_board.db ] || python -m app.seed; exec uvicorn serve:app --host 0.0.0.0 --port ${PORT:-8000}"]
