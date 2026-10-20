"""Tests for raw PDF download + Supabase Storage upload (mocked httpx)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.scraper.downloader import download_raw_pdf
from app.scraper.pdf_store import _sanitize, store_pdf


def _resp(status=200, content=b"", content_type="application/pdf"):
    r = MagicMock()
    r.status_code = status
    r.content = content
    r.headers = {"content-type": content_type}
    r.raise_for_status = MagicMock()
    return r


# ── 1. Raw PDF download success ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_download_raw_pdf_success():
    body = b"%PDF-1.4 fake pdf bytes"
    client = AsyncMock()
    client.get = AsyncMock(return_value=_resp(content=body, content_type="application/pdf"))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.scraper.downloader._is_allowed", new=AsyncMock(return_value=True)), \
         patch("app.scraper.downloader._rate_limit", new=AsyncMock()), \
         patch("app.scraper.downloader.httpx.AsyncClient", return_value=cm):
        result = await download_raw_pdf("https://aia.com.sg/brochure.pdf")

    assert result == body


# ── 2. Non-PDF rejected ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_download_raw_pdf_non_pdf_rejected():
    body = b"<html>404 not found</html>"
    client = AsyncMock()
    client.get = AsyncMock(return_value=_resp(content=body, content_type="text/html"))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.scraper.downloader._is_allowed", new=AsyncMock(return_value=True)), \
         patch("app.scraper.downloader._rate_limit", new=AsyncMock()), \
         patch("app.scraper.downloader.httpx.AsyncClient", return_value=cm):
        result = await download_raw_pdf("https://aia.com.sg/notapdf")

    assert result is None


# ── 3. Supabase upload success — path/headers/public URL ────────────────────────
@pytest.mark.asyncio
async def test_store_pdf_success():
    captured = {}

    async def fake_post(url, headers=None, content=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["content"] = content
        return _resp(status=200)

    client = AsyncMock()
    client.post = AsyncMock(side_effect=fake_post)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.scraper.pdf_store.settings") as s, \
         patch("app.scraper.pdf_store.httpx.AsyncClient", return_value=cm):
        s.supabase_url = "https://proj.supabase.co"
        s.supabase_service_role_key = "svc-key"
        s.supabase_documents_bucket = "documents"
        result = await store_pdf("aia", "aia_ci_power", b"%PDF-1.4")

    assert captured["url"] == (
        "https://proj.supabase.co/storage/v1/object/documents/aia/aia_ci_power.pdf"
    )
    assert captured["headers"]["Authorization"] == "Bearer svc-key"
    assert captured["headers"]["Content-Type"] == "application/pdf"
    assert captured["headers"]["x-upsert"] == "true"
    assert captured["content"] == b"%PDF-1.4"
    assert result == (
        "https://proj.supabase.co/storage/v1/object/public/documents/aia/aia_ci_power.pdf"
    )


# ── 4. Keyless no-op — no HTTP call ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_store_pdf_keyless_noop():
    cm = MagicMock()
    cm.__aenter__ = AsyncMock()
    cm.__aexit__ = AsyncMock(return_value=False)
    client_factory = MagicMock(return_value=cm)

    with patch("app.scraper.pdf_store.settings") as s, \
         patch("app.scraper.pdf_store.httpx.AsyncClient", client_factory):
        s.supabase_url = ""
        s.supabase_service_role_key = ""
        s.supabase_documents_bucket = "documents"
        result = await store_pdf("aia", "aia_ci_power", b"%PDF-1.4")

    assert result is None
    client_factory.assert_not_called()


# ── 5. Upload failure resilience — 500 → None, no raise ─────────────────────────
@pytest.mark.asyncio
async def test_store_pdf_upload_failure_returns_none():
    client = AsyncMock()
    client.post = AsyncMock(return_value=_resp(status=500))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.scraper.pdf_store.settings") as s, \
         patch("app.scraper.pdf_store.httpx.AsyncClient", return_value=cm):
        s.supabase_url = "https://proj.supabase.co"
        s.supabase_service_role_key = "svc-key"
        s.supabase_documents_bucket = "documents"
        result = await store_pdf("aia", "aia_ci_power", b"%PDF-1.4")

    assert result is None


# ── 6. Path sanitization — safe charset, case preserved ─────────────────────────
def test_sanitize_preserves_case_and_strips_unsafe():
    assert _sanitize("AIA/x!") == "AIA_x_"
    assert _sanitize("aia_ci-power") == "aia_ci-power"
    assert _sanitize("Great Eastern") == "Great_Eastern"
