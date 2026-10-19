"""conftest.py — Shared pytest fixtures."""

import json
import shutil
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def seed_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "seed"


@pytest.fixture
def tmp_data_dir(seed_dir: Path, tmp_path: Path) -> Path:
    """Create a temporary data directory pre-populated with seed files."""
    data = tmp_path / "data"
    data.mkdir()
    (data / "versions").mkdir()

    for fname in ["plans.json", "sources.json", "insurers.json", "users.json", "threads.json"]:
        src = seed_dir / fname
        if src.exists():
            shutil.copy(src, data / fname)

    (data / "audit.jsonl").write_text("")
    (data / "scraper_runs.jsonl").write_text("")

    return data


@pytest.fixture
def test_client(tmp_data_dir: Path, monkeypatch):
    """FastAPI test client with overridden data directory."""
    from app import config
    monkeypatch.setattr(config.settings, "data_dir", tmp_data_dir)

    from app.main import app
    return TestClient(app)
