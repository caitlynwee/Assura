"""mock.py — Serve and update the editable mock brochure page."""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

router = APIRouter()

MOCK_BROCHURE_PATH = Path(__file__).resolve().parents[2] / "mock_brochure" / "index.html"


@router.get("/brochure", response_class=HTMLResponse)
async def get_brochure():
    """Serve the mock brochure HTML page."""
    if not MOCK_BROCHURE_PATH.exists():
        raise HTTPException(status_code=404, detail="Mock brochure not found")
    return MOCK_BROCHURE_PATH.read_text(encoding="utf-8")


class UpdateBrochureRequest(BaseModel):
    html: str


@router.put("/brochure")
async def update_brochure(body: UpdateBrochureRequest):
    """Update the mock brochure content (for live demo editing)."""
    MOCK_BROCHURE_PATH.write_text(body.html, encoding="utf-8")
    return {"status": "updated", "bytes": len(body.html)}
