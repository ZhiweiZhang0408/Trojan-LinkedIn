#!/usr/bin/env bash
# Build for hosting: backend dependencies plus a frontend that talks to its own origin.
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v uv >/dev/null 2>&1 && [ -n "${REPL_ID:-}" ]; then
  # Replit's Python is read-only; its interpreter already reads packages from .pythonlibs.
  py="$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  uv pip install --quiet --target ".pythonlibs/lib/python${py}/site-packages" -r backend/requirements.txt
else
  python -m pip install -q -r backend/requirements.txt
fi

cd frontend
npm ci --no-audit --no-fund
# Demo accounts on the sign-in page log in to the seeded (fictional) users.
VITE_HOSTED=true VITE_DEMO_PASSWORD="${DEMO_PASSWORD:-password123}" npm run build
