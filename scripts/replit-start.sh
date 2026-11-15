#!/usr/bin/env bash
# Start the API and the built frontend on one port. Seeds demo data on first start only.
set -euo pipefail
cd "$(dirname "$0")/../backend"

# Without a SECRET_KEY secret, generate one once and keep it beside the database,
# so sign-in tokens stay valid across restarts.
if [ -z "${SECRET_KEY:-}" ]; then
  [ -f .secret_key ] || python -c "import secrets; print(secrets.token_hex(32))" > .secret_key
  export SECRET_KEY="$(cat .secret_key)"
fi

if [ ! -f referral_board.db ]; then
  python -m app.seed
fi

exec python -m uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8000}"
