"""Point every test at a throwaway database and upload folder.

This runs before any test module imports `app`, so tests can never touch the dev database.
"""
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["EMAIL_BACKEND"] = "console"
