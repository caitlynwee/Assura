"""Tests for change detection logic."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.scraper.change_detector import has_changed, update_source_metadata
from app.utils.hashing import sha256_bytes


@pytest.mark.asyncio
async def test_304_response_not_changed(monkeypatch):
    """A 304 Not Modified response should signal no change."""
    mock_response = MagicMock()
    mock_response.status_code = 304

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    monkeypatch.setattr("app.scraper.change_detector.get_client", lambda: mock_client)

    source = {"id": "test", "url": "http://example.com", "etag": '"abc123"'}
    changed, _ = await has_changed(source)
    assert changed is False


@pytest.mark.asyncio
async def test_same_hash_not_changed(monkeypatch):
    """Same content hash should signal no change."""
    content = b"<html>test content</html>"
    content_hash = sha256_bytes(content)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = content
    mock_response.headers = {}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    monkeypatch.setattr("app.scraper.change_detector.get_client", lambda: mock_client)

    source = {"id": "test", "url": "http://example.com", "contentHash": content_hash}
    changed, _ = await has_changed(source)
    assert changed is False


@pytest.mark.asyncio
async def test_different_content_changed(monkeypatch):
    """Different content should signal a change."""
    content = b"<html>new content</html>"

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = content
    mock_response.headers = {}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    monkeypatch.setattr("app.scraper.change_detector.get_client", lambda: mock_client)

    source = {"id": "test", "url": "http://example.com", "contentHash": "oldhash"}
    changed, _ = await has_changed(source)
    assert changed is True
