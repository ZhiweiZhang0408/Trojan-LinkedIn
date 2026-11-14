"""Rebuild the database with fictional demo data: python -m app.seed

WARNING: wipes the local database. Run it after every `git pull`.

Each module owns its own seed function in app/seeds/<module>.py.
All modules share the same demo users created by seed_core().
"""
from . import models_connections, models_persona  # noqa: F401  register tables
from .database import Base, SessionLocal, engine
from .seeds.connections import seed_connections
from .seeds.core import PASSWORD, seed_core
from .seeds.persona import seed_persona


def run():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users = seed_core(db)  # users, job posts, referral requests
        seed_connections(db, users)
        seed_persona(db, users)
        db.commit()
    finally:
        db.close()
    print(f"Seeded demo data. All accounts use password: {PASSWORD}")
    print("Demo users:", ", ".join(users))


if __name__ == "__main__":
    run()
