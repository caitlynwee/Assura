"""Tests for the scraper engine pipeline."""

import json
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_failed_scrape_preserves_last_good_data(tmp_data_dir, monkeypatch):
    """A failed scrape should NOT modify plans.json."""
    from app import config
    monkeypatch.setattr(config.settings, "data_dir", tmp_data_dir)

    plans_before = json.loads((tmp_data_dir / "plans.json").read_text())

    # Patch has_changed to return True (change detected) then downloader to fail
    with patch("app.scraper.engine.has_changed", new=AsyncMock(return_value=(True, None))):
        with patch("app.scraper.engine.download_page", new=AsyncMock(side_effect=Exception("Network error"), spec=lambda url, existing_response=None, source_type="product_page": None)):
            from app.scraper.engine import run_scraper
            result = await run_scraper(trigger="manual")

    plans_after = json.loads((tmp_data_dir / "plans.json").read_text())

    assert plans_before == plans_after  # unchanged
    assert result["sourcesChanged"] == 0
    assert len(result["errors"]) > 0


@pytest.mark.asyncio
async def test_no_change_skips_pipeline(tmp_data_dir, monkeypatch):
    """If no source has changed, plans.json should not be written."""
    from app import config
    monkeypatch.setattr(config.settings, "data_dir", tmp_data_dir)

    plans_before = json.loads((tmp_data_dir / "plans.json").read_text())

    with patch("app.scraper.engine.has_changed", new=AsyncMock(return_value=(False, None))):
        from app.scraper.engine import run_scraper
        result = await run_scraper(trigger="manual")

    plans_after = json.loads((tmp_data_dir / "plans.json").read_text())
    assert plans_before == plans_after
    assert result["sourcesChanged"] == 0
