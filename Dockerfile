# One container serving the API and the built frontend (used by Render; works on any Docker host).
FROM node:22-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Demo accounts on the sign-in page log in to the seeded (fictional) users.
ARG DEMO_PASSWORD=password123
RUN VITE_HOSTED=true VITE_DEMO_PASSWORD="$DEMO_PASSWORD" npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY scripts/replit-start.sh scripts/replit-start.sh
COPY --from=web /app/frontend/dist frontend/dist
ENV PORT=10000
EXPOSE 10000
# Seeds the demo SQLite database on first start, then serves on $PORT.
CMD ["bash", "scripts/replit-start.sh"]
