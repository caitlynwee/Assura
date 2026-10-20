"""storage.py — Upload files to Supabase Storage."""

import httpx

from app.config import settings

BUCKET = "source-docs"


async def upload_pdf(source_id: str, pdf_bytes: bytes) -> str:
    """Upload a PDF to Supabase Storage and return its public URL.

    Returns empty string if upload fails or credentials are missing.
    The bucket must exist in Supabase (create via dashboard: Storage → New bucket).
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("[storage] No Supabase credentials — skipping PDF upload")
        return ""

    path = f"{source_id}.pdf"
    upload_url = f"{settings.supabase_url}/storage/v1/object/{BUCKET}/{path}"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                upload_url,
                content=pdf_bytes,
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    "Content-Type": "application/pdf",
                    "x-upsert": "true",  # overwrite on re-run
                },
            )
            resp.raise_for_status()

        public_url = f"{settings.supabase_url}/storage/v1/object/public/{BUCKET}/{path}"
        print(f"[storage] Uploaded {source_id}.pdf → {public_url}")
        return public_url

    except Exception as exc:  # noqa: BLE001
        print(f"[storage] Upload failed for {source_id}: {exc}")
        return ""
