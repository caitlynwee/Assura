"""pdf_store.py — Upload stored brochure PDFs to public Supabase Storage.

Owns the Supabase Storage concern for the scraper: it uploads a raw PDF to the
public `documents` bucket via the Storage REST API (httpx, no SDK) and returns
the public URL. Keyless-safe: when Supabase is not configured, it no-ops and
returns None so the scrape still succeeds. Never raises to the engine.
"""

import re

import httpx

from app.config import settings

_UNSAFE = re.compile(r"[^A-Za-z0-9_-]")


def _sanitize(seg: str) -> str:
    """Replace anything outside [A-Za-z0-9_-] with '_'. Does NOT lowercase, so
    the object key stays byte-identical to the plan/insurer id."""
    return _UNSAFE.sub("_", seg)


async def store_pdf(insurer_id: str, plan_id: str, pdf_bytes: bytes) -> str | None:
    """Upload PDF to the public bucket; return its public URL or None.

    Path: <insurer_id>/<plan_id>.pdf (each segment sanitized).
    Keyless no-op when Supabase url/key is absent. Any non-2xx or exception →
    logged warning and None (never raises).
    """
    base = settings.supabase_url.rstrip("/")
    key = settings.supabase_service_role_key
    bucket = settings.supabase_documents_bucket

    if not base or not key:
        print("[pdf_store] Supabase not configured — skipping upload")
        return None

    path = f"{_sanitize(insurer_id)}/{_sanitize(plan_id)}.pdf"
    upload_url = f"{base}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/pdf",
        "x-upsert": "true",
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0), follow_redirects=True
        ) as client:
            resp = await client.post(upload_url, headers=headers, content=pdf_bytes)
        if resp.status_code // 100 != 2:
            print(f"[pdf_store] upload failed ({resp.status_code}) for {path}")
            return None
    except Exception as exc:  # noqa: BLE001 — upload is best-effort
        print(f"[pdf_store] upload error for {path}: {exc}")
        return None

    return f"{base}/storage/v1/object/public/{bucket}/{path}"
