#!/usr/bin/env bash
# Build for hosting: backend dependencies plus a frontend that talks to its own origin.
set -euo pipefail
cd "$(dirname "$0")/.."

python -m pip install -q -r backend/requirements.txt

cd frontend
npm ci --no-audit --no-fund
# Demo accounts on the sign-in page log in to the seeded (fictional) users.
VITE_HOSTED=true VITE_DEMO_PASSWORD="${DEMO_PASSWORD:-password123}" npm run build
