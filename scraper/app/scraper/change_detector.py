"""change_detector.py — Detect whether a source has changed since last scrape.

Strategy 1: HTTP conditional request (ETag / If-Modified-Since).
Strategy 2: SHA-256 hash comparison (fallback for sources without caching headers).
"""


import httpx

from app.utils.hashing import sha256_bytes
from app.utils.http_client import get_client


async def has_changed(source: dict) -> tuple[bool, httpx.Response]:
    """Return (changed, response). Downloads page if changed."""
    client = get_client()
    headers = {}

    if source.get("etag"):
        headers["If-None-Match"] = source["etag"]
    elif source.get("lastModified"):
        headers["If-Modified-Since"] = source["lastModified"]

    response = await client.get(source["url"], headers=headers)

    if response.status_code == 304:
        return False, response

    # Check hash fallback
    if source.get("contentHash"):
        new_hash = sha256_bytes(response.content)
        if new_hash == source["contentHash"]:
            return False, response

    return True, response


def update_source_metadata(source: dict, response: httpx.Response, content: bytes) -> dict:
    """Update ETag, Last-Modified, and content hash after a successful scrape."""
    updated = dict(source)
    updated["etag"] = response.headers.get("etag")
    updated["lastModified"] = response.headers.get("last-modified")
    updated["contentHash"] = sha256_bytes(content)
    from app.utils.time import now_utc_iso
    updated["lastChecked"] = now_utc_iso()
    updated["lastChanged"] = now_utc_iso()
    updated["status"] = "ok"
    return updated
