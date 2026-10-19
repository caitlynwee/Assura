"""Tests for the PII blocker."""

from app.email_relay.pii_blocker import scan_for_pii, assert_no_pii
import pytest


def test_detects_nric():
    result = scan_for_pii("My NRIC is S1234567A.")
    assert result.blocked
    assert any(m.type == "nric" for m in result.matches)


def test_detects_phone():
    result = scan_for_pii("Call me at 91234567.")
    assert result.blocked
    assert any(m.type == "phone" for m in result.matches)


def test_detects_health_keyword():
    result = scan_for_pii("I was diagnosed with cancer last year.")
    assert result.blocked
    assert any(m.type == "health_keyword" for m in result.matches)


def test_detects_income_keyword():
    result = scan_for_pii("My annual income is 80,000.")
    assert result.blocked
    assert any(m.type == "income" for m in result.matches)


def test_clean_text_passes():
    result = scan_for_pii(
        "I am interested in learning more about your critical illness plans."
    )
    assert not result.blocked
    assert len(result.matches) == 0


def test_assert_no_pii_raises_on_nric():
    with pytest.raises(ValueError, match="nric"):
        assert_no_pii("NRIC: T1234567Z please process my application.")


def test_assert_no_pii_passes_clean():
    assert_no_pii("Please send me a quote for a 30-year-old non-smoker.")
