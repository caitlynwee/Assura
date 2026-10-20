"""downloader.py — Fetch page content respecting robots.txt and rate limits.

Routing:
  source_type == "mock"                    → plain httpx (localhost only)
  source_type == "product_page" or "pdf"  → Jina Reader API (handles JS + PDFs)

Jina Reader (r.jina.ai) proxies any URL through their rendering infrastructure
and returns clean markdown. No Playwright, no bot detection issues, works for
both web pages and PDF brochures.
"""

import asyncio
import os
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.utils.debug_dump import dump
from app.utils.http_client import USER_AGENT, get_client

# Per-domain last-fetch timestamp for rate limiting
_last_fetch: dict[str, float] = {}

JINA_BASE = "https://r.jina.ai"


async def download_page(
    url: str,
    existing_response: httpx.Response | None = None,
    source_type: str = "product_page",
) -> bytes:
    """Download a URL and return clean text bytes via Jina Reader.

    Mock sources use plain httpx (fast, localhost only).
    All other sources go through Jina Reader which handles JS rendering,
    bot bypassing, and PDF text extraction transparently.
    """
    domain = _get_domain(url)

    if not await _is_allowed(url):
        raise PermissionError(f"robots.txt disallows scraping {url}")

    await _rate_limit(domain)

    if source_type == "mock":
        if existing_response is not None and existing_response.status_code == 200:
            _last_fetch[domain] = asyncio.get_event_loop().time()
            return existing_response.content
        client = get_client()
        response = await client.get(url)
        response.raise_for_status()
        _last_fetch[domain] = asyncio.get_event_loop().time()
        return response.content

    # product_page + pdf → Jina Reader
    jina_url = f"{JINA_BASE}/{url}"
    headers = {"Accept": "text/plain", "User-Agent": USER_AGENT}
    api_key = os.environ.get("JINA_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # Jina can take longer on heavy pages/PDFs — use a separate long-timeout client
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0), follow_redirects=True) as client:
        response = await client.get(jina_url, headers=headers)
        response.raise_for_status()

    _last_fetch[domain] = asyncio.get_event_loop().time()
    text = response.content.decode("utf-8", errors="replace")
    print(f"[downloader] Jina fetched {url} → {len(response.content)} bytes")
    dump(f"jina_{source_type}", {"url": url, "jina_url": jina_url, "content": text})
    return response.content


async def download_raw_pdf(url: str) -> bytes | None:
    """Download the RAW PDF bytes for a brochure URL (separate from Jina text).

    Reuses the existing robots + rate-limit pattern. Returns the PDF bytes when
    the response is a PDF (by content-type OR leading %PDF- magic bytes), or
    None when robots disallows the fetch or the body is not a PDF. Transport/HTTP
    errors (raise_for_status, timeouts) propagate to the caller, which treats any
    exception as "no stored copy".
    """
    domain = _get_domain(url)

    if not await _is_allowed(url):
        return None

    await _rate_limit(domain)

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(120.0),
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        resp = await client.get(url)

    _last_fetch[domain] = asyncio.get_event_loop().time()
    resp.raise_for_status()

    ctype = resp.headers.get("content-type", "").lower()
    body = resp.content
    looks_pdf = "application/pdf" in ctype or body[:5] == b"%PDF-"
    if not looks_pdf:
        return None
    return body


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
