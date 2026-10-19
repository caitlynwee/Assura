"""downloader.py — Fetch page content respecting robots.txt and rate limits."""

import asyncio
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.utils.http_client import USER_AGENT, get_client

# In-memory per-domain last-fetch timestamp
_last_fetch: dict[str, float] = {}


async def download_page(url: str, existing_response: httpx.Response | None = None) -> bytes:
    """Download a URL, respecting robots.txt and rate limits. Returns raw bytes."""
    domain = _get_domain(url)

    # Check robots.txt
    if not await _is_allowed(url):
        raise PermissionError(f"robots.txt disallows scraping {url}")

    # Rate limit: wait if we fetched this domain recently
    await _rate_limit(domain)

    # If we already have the response (from change detection), reuse it
    if existing_response is not None and existing_response.status_code == 200:
        _last_fetch[domain] = asyncio.get_event_loop().time()
        return existing_response.content

    client = get_client()
    response = await client.get(url)
    response.raise_for_status()
    _last_fetch[domain] = asyncio.get_event_loop().time()
    return response.content


async def _rate_limit(domain: str) -> None:
    last = _last_fetch.get(domain, 0.0)
    elapsed = asyncio.get_event_loop().time() - last
    delay = settings.scraper_rate_limit_delay - elapsed
    if delay > 0:
        await asyncio.sleep(delay)


async def _is_allowed(url: str) -> bool:
    """Check robots.txt for the given URL."""
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
        return True  # if robots.txt check fails, allow (fail open for public pages)


def _get_domain(url: str) -> str:
    return urlparse(url).netloc
