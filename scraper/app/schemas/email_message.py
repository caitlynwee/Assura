
from pydantic import BaseModel


class EmailMessage(BaseModel):
    from_address: str
    to_address: str
    subject: str
    body: str
    thread_id: str | None = None
    timestamp: str
    ai_disclosure: bool = True
