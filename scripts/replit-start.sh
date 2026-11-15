#!/usr/bin/env bash
# Start the API and the built frontend on one port. Seeds demo data on first start only.
set -euo pipefail
cd "$(dirname "$0")/../backend"

if [ ! -f referral_board.db ]; then
  python -m app.seed
fi

exec python -m uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8000}"
