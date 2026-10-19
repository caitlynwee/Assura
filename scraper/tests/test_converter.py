"""Tests for the converter module (DeepSeek AI integration)."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


MOCK_SOURCE = {
    "id": "src_mock_brochure",
    "insurerId": "manulife",
    "planIds": ["manulife_ci_care"],
    "url": "http://localhost:8100/mock/brochure",
}

VALID_LLM_RESPONSE = {
    "planName": "ManuCare CI Saver",
    "coverageAmount": 150000,
    "premiums": {
        "male_30_nonsmoker": 900,
        "male_40_nonsmoker": 1600,
        "female_30_nonsmoker": 750,
        "female_40_nonsmoker": 1350,
    },
    "illnessesCovered": 36,
    "earlyStageConditions": True,
    "keyBenefits": ["100% payout on diagnosis", "Premium waiver on claim"],
    "exclusions": ["Pre-existing conditions"],
    "dataAsOf": "2026-10-01",
}


def _make_mock_response(content: str) -> MagicMock:
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


@pytest.mark.asyncio
async def test_converter_parses_valid_json(monkeypatch):
    """Converter should parse valid JSON from DeepSeek and return a plan dict."""
    mock_resp = _make_mock_response(json.dumps(VALID_LLM_RESPONSE))

    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    with patch("app.scraper.converter._get_client", return_value=mock_client):
        from app.scraper.converter import convert_to_plan
        result = await convert_to_plan("some extracted text", MOCK_SOURCE)

    assert result["planName"] == "ManuCare CI Saver"
    assert result["coverageAmount"] == 150000
    assert result["illnessesCovered"] == 36


@pytest.mark.asyncio
async def test_converter_fills_metadata_from_source(monkeypatch):
    """Converter should fill id, insurerId, sourceUrl from the source dict."""
    mock_resp = _make_mock_response(json.dumps(VALID_LLM_RESPONSE))

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    with patch("app.scraper.converter._get_client", return_value=mock_client):
        from app.scraper.converter import convert_to_plan
        result = await convert_to_plan("some text", MOCK_SOURCE)

    assert result["id"] == "manulife_ci_care"
    assert result["insurerId"] == "manulife"
    assert result["sourceUrl"] == "http://localhost:8100/mock/brochure"
    assert result["category"] == "critical_illness"
    assert result["updatedBadge"] is True


@pytest.mark.asyncio
async def test_converter_raises_on_non_json(monkeypatch):
    """Converter should raise ValueError when LLM returns non-JSON."""
    mock_resp = _make_mock_response("Sorry, I cannot extract that information.")

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)

    with patch("app.scraper.converter._get_client", return_value=mock_client):
        from app.scraper.converter import convert_to_plan
        with pytest.raises(ValueError, match="non-JSON"):
            await convert_to_plan("some text", MOCK_SOURCE)


@pytest.mark.asyncio
async def test_converter_truncates_long_input(monkeypatch):
    """Converter should truncate input to MAX_INPUT_CHARS."""
    captured = {}

    async def mock_create(**kwargs):
        captured["messages"] = kwargs["messages"]
        return _make_mock_response(json.dumps(VALID_LLM_RESPONSE))

    mock_client = MagicMock()
    mock_client.chat.completions.create = mock_create

    from app.scraper.converter import MAX_INPUT_CHARS
    long_text = "x" * (MAX_INPUT_CHARS + 5000)

    with patch("app.scraper.converter._get_client", return_value=mock_client):
        from app.scraper.converter import convert_to_plan
        await convert_to_plan(long_text, MOCK_SOURCE)

    user_msg = captured["messages"][1]["content"]
    assert len(user_msg) <= MAX_INPUT_CHARS + 100  # prompt prefix is ~60 chars
