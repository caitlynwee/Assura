"""base.py — Abstract base class for insurer reply personas."""

from abc import ABC, abstractmethod


class PersonaBase(ABC):
    @abstractmethod
    async def reply(self, thread: dict) -> dict:
        """Generate a reply email dict for the given thread.

        Returns a dict with keys: subject, body, flagged, flagReason.
        """
        ...
