"""Settings come from the environment / .env and never contain hardcoded secrets."""
import os

from app import config


def test_dotenv_loader_does_not_override_real_env(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text('# comment\nTL_TEST_A="from-file"\nTL_TEST_B=from-file\nnot a pair\n\n', encoding="utf-8")
    monkeypatch.setenv("TL_TEST_B", "from-env")
    monkeypatch.delenv("TL_TEST_A", raising=False)
    config._load_dotenv(env)
    assert os.environ["TL_TEST_A"] == "from-file"
    assert os.environ["TL_TEST_B"] == "from-env"
    config._load_dotenv(tmp_path / "missing.env")  # no error


def test_load_settings_from_environment(monkeypatch):
    monkeypatch.setenv("TROJANLINK_SKIP_DOTENV", "1")
    monkeypatch.setenv("SECRET_KEY", "")
    monkeypatch.setenv("SEED_DEMO_DATA", "no")
    monkeypatch.setenv("CORS_ORIGINS", "http://a.example, http://b.example ,")
    monkeypatch.setenv("MAX_RESUME_MB", "2")
    s = config.load_settings()
    assert len(s.secret_key) >= 32  # random per-process fallback, never a fixed default
    assert s.seed_demo_data is False
    assert s.cors_origins == ["http://a.example", "http://b.example"]
    assert s.max_resume_bytes == 2 * 1024 * 1024
    assert s.llm_api_key is None
