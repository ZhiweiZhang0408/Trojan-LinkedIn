"""CLI: reset and re-seed the local demo database.

    python -m app.seed --reset
"""
from __future__ import annotations

import argparse
import sys

from .config import settings
from .database import Base, SessionLocal, engine
from .services.seed import seed_demo


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed fictional TrojanLink demo data")
    parser.add_argument("--reset", action="store_true", help="Drop all tables first (destroys local data)")
    args = parser.parse_args()
    if not settings.demo_user_password:
        print("Set DEMO_USER_PASSWORD in backend/.env (see .env.example) first.", file=sys.stderr)
        return 1
    if args.reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seeded = seed_demo(db, settings.demo_user_password)
    print("Seeded demo data." if seeded else "Database already has users; use --reset to re-seed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
