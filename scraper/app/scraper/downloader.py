"""downloader.py — Fetch page content respecting robots.txt and rate limits.

Routing:
  source_type == "mock"         → plain httpx (fast, for localhost mock brochure)
  source_type == "product_page" → Playwright headless Chromium (renders JS SPAs)
"""

import asyncio
from urllib.parse import urlparse

import httpx
from playwright.async_api import Browser, Playwright, async_playwright

from app.config import settings
from app.utils.http_client import USER_AGENT, get_client

# Per-domain last-fetch timestamp for rate limiting
_last_fetch: dict[str, float] = {}

# Playwright singletons (lazy-initialised, reused across scrape runs)
_playwright: Playwright | None = None
_browser: Browser | None = None


async def _get_browser() -> Browser:
    global _playwright, _browser
    if _browser is None or not _browser.is_connected():
        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(headless=True)
    return _browser


async def download_page(
    url: str,
    existing_response: httpx.Response | None = None,
    source_type: str = "product_page",
) -> bytes:
    """Download a URL and return raw bytes.

    Uses plain httpx for mock sources (fast).
    Uses Playwright for product_page sources (renders JS-heavy insurer SPAs).
    """
    domain = _get_domain(url)

    if not await _is_allowed(url):
        raise PermissionError(f"robots.txt disallows scraping {url}")

    await _rate_limit(domain)

    if source_type == "mock":
        # Reuse existing httpx response if available; otherwise fetch fresh
        if existing_response is not None and existing_response.status_code == 200:
            _last_fetch[domain] = asyncio.get_event_loop().time()
            return existing_response.content
        client = get_client()
        response = await client.get(url)
        response.raise_for_status()
        _last_fetch[domain] = asyncio.get_event_loop().time()
        return response.content

    # product_page — use Playwright to render the full JS SPA
    browser = await _get_browser()
    page = await browser.new_page(user_agent=USER_AGENT)
    try:
        await page.goto(url, wait_until="networkidle", timeout=30_000)
        html = await page.content()
        _last_fetch[domain] = asyncio.get_event_loop().time()
        return html.encode("utf-8")
    finally:
        await page.close()


async def _rate_limit(domain: str) -> None:
    last = _last_fetch.get(domain, 0.0)
    elapsed = asyncio.get_event_loop().time() - last
    delay = settings.scraper_rate_limit_delay - elapsed
    if delay > 0:
        await asyncio.sleep(delay)


async def _is_allowed(url: str) -> bool:
    """Check robots.txt for the given URL. Fails open."""
    try:
        from robotexclusionrulesparser import RobotExclusionRulesParser

        domain = _get_domain(url)
        robots_url = f"https://{domain}/robots.txt"
        client = get_client()
        resp = await client.get(robots_url, timeout=5.0)
        parser = RobotExclusionRulesParser()
        parser.parse(resp.text)
        return parser.is_allowed(USER_AGENT, url)
    except Exception:  # noqa: BLE001
        return True  # fail open for public pages


def _get_domain(url: str) -> str:
    return urlparse(url).netloc
