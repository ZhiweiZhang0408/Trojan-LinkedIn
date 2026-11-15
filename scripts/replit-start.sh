#!/usr/bin/env bash
# Start the API and the built frontend on one port.
set -euo pipefail
cd "$(dirname "$0")/../backend"

# The demo always runs on its own SQLite file. Replit may inject a DATABASE_URL for a
# PostgreSQL database; seeding wipes the database, so never point it there.
export DATABASE_URL="sqlite:///$PWD/referral_board.db"

# Without a SECRET_KEY secret, generate one once and keep it beside the database,
# so sign-in tokens stay valid across restarts.
if [ -z "${SECRET_KEY:-}" ]; then
  [ -f .secret_key ] || python -c "import secrets; print(secrets.token_hex(32))" > .secret_key
  export SECRET_KEY="$(cat .secret_key)"
fi

# Seed on first start, and again only when the seed data or the tables change.
stamp="$(cat app/seed.py app/seeds/*.py app/models*.py | python -c 'import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())')"
if [ ! -f referral_board.db ] || [ "$(cat .seed_stamp 2>/dev/null)" != "$stamp" ]; then
  python -m app.seed
  echo "$stamp" > .seed_stamp
fi

exec python -m uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8000}"
