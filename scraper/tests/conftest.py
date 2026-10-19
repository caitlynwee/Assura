"""conftest.py — Shared pytest fixtures."""

from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def seed_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "seed"
