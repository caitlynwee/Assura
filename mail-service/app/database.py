from __future__ import annotations

from sqlalchemy import Boolean, Column, Integer, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings


class Base(DeclarativeBase):
    pass


class Insurer(Base):
    __tablename__ = "insurers"

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    agent_email = Column(Text, nullable=False)
    persona = Column(Text, nullable=False)


class Thread(Base):
    __tablename__ = "threads"

    id = Column(Text, primary_key=True)
    insurer_id = Column(Text, nullable=False)
    insurer_name = Column(Text, nullable=False)
    subject = Column(Text, nullable=False)
    status = Column(Text, nullable=False)


class ThreadMessage(Base):
    __tablename__ = "thread_messages"

    id = Column(Text, primary_key=True)
    thread_id = Column(Text, nullable=False)
    ordering = Column(Integer, nullable=False)
    direction = Column(Text, nullable=False)
    from_ = Column("from", Text, nullable=False)
    to = Column(Text, nullable=False)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    timestamp = Column(Text, nullable=False)
    ai_generated = Column(Boolean, nullable=False)
    flagged = Column(Boolean, nullable=False)
    flag_reason = Column(Text)


_SessionLocal: sessionmaker[Session] | None = None


def get_session() -> Session:
    global _SessionLocal
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not set")
    if _SessionLocal is None:
        url = settings.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
        local = "localhost" in url or "127.0.0.1" in url
        engine = create_engine(
            url,
            poolclass=NullPool,
            connect_args={} if local else {"sslmode": "require"},
        )
        _SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return _SessionLocal()
