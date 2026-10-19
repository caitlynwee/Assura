
from pydantic import BaseModel


class Source(BaseModel):
    id: str
    insurer_id: str
    label: str
    url: str
    type: str  # "product_page" | "pdf" | "mock"
    plan_ids: list[str] = []
    etag: str | None = None
    last_modified: str | None = None
    content_hash: str | None = None
    last_checked: str | None = None
    last_changed: str | None = None
    status: str = "pending"
