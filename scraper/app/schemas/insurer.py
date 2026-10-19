from pydantic import BaseModel


class Insurer(BaseModel):
    id: str
    name: str
    agent_email: str
    logo: str
    persona: str  # "helpful" | "slow" | "pushy" | "data_grabber" | "injector"
    website: str
