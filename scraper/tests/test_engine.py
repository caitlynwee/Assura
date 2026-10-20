"""Tests for the scraper engine pipeline."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_source_row(source_id="src_aia_ci"):
    """Return a mock SQLAlchemy Source object."""
    s = MagicMock()
    s.id = source_id
    s.insurer_id = "aia"
    s.label = "AIA CI Power"
    s.url = "https://www.aia.com.sg/en/our-products/critical-illness.html"
    s.type = "product_page"
    s.plan_ids = ["aia_ci_power"]
    s.etag = None
    s.last_modified = None
    s.content_hash = None
    s.last_checked = None
    s.last_changed = None
    s.status = "ok"
    return s


def _make_plan_row(plan_id="aia_ci_power"):
    """Return a mock SQLAlchemy Plan object."""
    p = MagicMock()
    p.id = plan_id
    p.insurer_id = "aia"
    p.insurer_name = "AIA"
    p.plan_name = "AIA Power Critical Cover"
    p.change_notes = []
    p.version = 1
    return p


def _make_session(sources, plans):
    """Build a mock SQLAlchemy Session that serves the given rows."""
    session = MagicMock()
    source_query = MagicMock()
    source_query.filter_by.return_value = source_query
    source_query.all.return_value = sources
    plan_query = MagicMock()
    plan_query.all.return_value = plans
    session.query.side_effect = lambda model: (
        source_query if model.__name__ == "Source" else plan_query
    )
    return session


@pytest.mark.asyncio
async def test_failed_scrape_preserves_last_good_data():
    """A download failure must not commit plan/source changes (expunge_all path)."""
    source = _make_source_row()
    plan = _make_plan_row()
    session = _make_session([source], [plan])

    source_dict = {
        "id": source.id, "insurerId": source.insurer_id, "url": source.url,
        "type": source.type, "planIds": source.plan_ids,
        "etag": None, "lastModified": None, "contentHash": None,
        "lastChecked": None, "lastChanged": None, "status": "ok",
    }

    with patch("app.scraper.engine.get_session", return_value=session), \
         patch("app.scraper.engine.has_changed", new=AsyncMock(return_value=(True, None))), \
         patch("app.scraper.engine.download_page", new=AsyncMock(side_effect=RuntimeError("network error"))), \
         patch("app.scraper.engine.source_to_camel", return_value=source_dict):
        from app.scraper.engine import run_scraper
        result = await run_scraper(trigger="manual")

    # expunge_all() must have been called (invariant: no dirty objects committed)
    session.expunge_all.assert_called_once()
    assert result["sourcesChanged"] == 0
    assert len(result["errors"]) > 0


@pytest.mark.asyncio
async def test_no_change_skips_pipeline():
    """If no source has changed, no plan/source writes occur."""
    source = _make_source_row()
    plan = _make_plan_row()
    session = _make_session([source], [plan])

    source_dict = {
        "id": source.id, "insurerId": source.insurer_id, "url": source.url,
        "type": source.type, "planIds": source.plan_ids,
        "etag": None, "lastModified": None, "contentHash": None,
        "lastChecked": None, "lastChanged": None, "status": "ok",
    }

    with patch("app.scraper.engine.get_session", return_value=session), \
         patch("app.scraper.engine.has_changed", new=AsyncMock(return_value=(False, None))), \
         patch("app.scraper.engine.source_to_camel", return_value=source_dict):
        from app.scraper.engine import run_scraper
        result = await run_scraper(trigger="manual")

    session.expunge_all.assert_called_once()
    assert result["sourcesChanged"] == 0


@pytest.mark.asyncio
async def test_changed_source_uses_downloader_supported_arguments():
    """A changed source reaches download_page with its supported signature."""
    source = _make_source_row()
    plan = _make_plan_row()
    session = _make_session([source], [plan])

    source_dict = {
        "id": source.id, "insurerId": source.insurer_id, "url": source.url,
        "type": source.type, "planIds": source.plan_ids,
        "etag": None, "lastModified": None, "contentHash": None,
        "lastChecked": None, "lastChanged": None, "status": "ok",
    }
    download = AsyncMock(return_value=b"<p>updated brochure</p>")
    response = MagicMock()
    response.content = b"<p>updated brochure</p>"

    with patch("app.scraper.engine.get_session", return_value=session), \
         patch("app.scraper.engine.has_changed", new=AsyncMock(return_value=(True, response))), \
         patch("app.scraper.engine.download_page", new=download), \
         patch("app.scraper.engine.extract_text", return_value="updated brochure"), \
         patch("app.scraper.engine.convert_to_plan", new=AsyncMock(return_value={})), \
         patch("app.scraper.engine.validate_plan", return_value={"planName": "Updated plan"}), \
         patch("app.scraper.engine.source_to_camel", return_value=source_dict), \
         patch("app.scraper.engine.update_source_metadata", return_value=source_dict), \
         patch("app.scraper.engine.apply_source_update"):
        from app.scraper.engine import run_scraper
        result = await run_scraper(trigger="manual", source_id=source.id)

    download.assert_awaited_once_with(
        source.url, response, source_type="product_page"
    )
    assert result["sourcesChecked"] == 1
    assert result["sourcesChanged"] == 1
    assert result["errors"] == []
