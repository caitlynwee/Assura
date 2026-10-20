"""database.py — SQLAlchemy 2.0 mapping layer for the shared PostgreSQL database.

Drizzle ORM (web/) is the sole owner of the schema and migrations.
SQLAlchemy MAPS to the Drizzle-created tables — it emits NO DDL.

Column names here must match the snake_case SQL column names in
web/src/lib/schema.ts exactly.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    Text,
    create_engine,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


# ── Insurer ────────────────────────────────────────────────────────────────────
class Insurer(Base):
    __tablename__ = "insurers"

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    agent_email = Column(Text, nullable=False)
    logo = Column(Text, nullable=False)
    persona = Column(Text, nullable=False)
    website = Column(Text, nullable=False)
    country = Column(Text, nullable=False)


# ── Plan ───────────────────────────────────────────────────────────────────────
class Plan(Base):
    __tablename__ = "plans"

    id = Column(Text, primary_key=True)
    insurer_id = Column(Text, nullable=False)
    insurer_name = Column(Text, nullable=False)
    plan_name = Column(Text, nullable=False)
    category = Column(Text, nullable=False)
    coverage_amount = Column(Integer, nullable=False)
    premiums = Column(JSONB, nullable=False)
    premium_frequency = Column(Text, nullable=False)
    coverage_terms = Column(JSONB, nullable=False)
    illnesses_covered = Column(Integer, nullable=False)
    early_stage_conditions = Column(Boolean, nullable=False)
    payout_type = Column(Text, nullable=False)
    key_benefits = Column(JSONB, nullable=False)
    exclusions = Column(JSONB, nullable=False)
    source_url = Column(Text, nullable=False)
    data_as_of = Column(Text, nullable=False)
    updated_badge = Column(Boolean, nullable=False)
    change_notes = Column(JSONB, nullable=False)
    version = Column(Integer, nullable=False)
    scraped_at = Column(Text, nullable=False)
    country = Column(Text, nullable=False)


# ── Source ─────────────────────────────────────────────────────────────────────
class Source(Base):
    __tablename__ = "sources"

    id = Column(Text, primary_key=True)
    insurer_id = Column(Text, nullable=False)
    label = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    plan_ids = Column(JSONB, nullable=False)
    etag = Column(Text)
    last_modified = Column(Text)
    content_hash = Column(Text)
    last_checked = Column(Text)
    last_changed = Column(Text)
    status = Column(Text, nullable=False)
    country = Column(Text, nullable=False)


# ── Thread ─────────────────────────────────────────────────────────────────────
class Thread(Base):
    __tablename__ = "threads"

    id = Column(Text, primary_key=True)
    user_id = Column(Text, nullable=False)
    insurer_id = Column(Text, nullable=False)
    insurer_name = Column(Text, nullable=False)
    subject = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    extracted_quote = Column(JSONB)
    risk_flags = Column(JSONB, nullable=False)
    added_to_comparison = Column(Boolean, nullable=False)
    created_at = Column(Text, nullable=False)
    updated_at = Column(Text, nullable=False)


# ── ThreadMessage ──────────────────────────────────────────────────────────────
# Note: `from` is a Python keyword — mapped via column("from", ...) pattern.
class ThreadMessage(Base):
    __tablename__ = "thread_messages"

    id = Column(Text, primary_key=True)
    thread_id = Column(Text, nullable=False)
    ordering = Column(Integer, nullable=False)
    direction = Column(Text, nullable=False)
    from_ = Column("from", Text, nullable=False)  # `from` is a Python keyword
    to = Column(Text, nullable=False)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    timestamp = Column(Text, nullable=False)
    ai_generated = Column(Boolean, nullable=False)
    flagged = Column(Boolean, nullable=False)
    flag_reason = Column(Text)


# ── ScraperRun ─────────────────────────────────────────────────────────────────
class ScraperRun(Base):
    __tablename__ = "scraper_runs"

    run_id = Column(Text, primary_key=True)
    trigger = Column(Text, nullable=False)
    started_at = Column(Text, nullable=False)
    finished_at = Column(Text, nullable=False)
    sources_checked = Column(Integer, nullable=False)
    sources_changed = Column(Integer, nullable=False)
    errors = Column(JSONB, nullable=False)


# ── Session factory ────────────────────────────────────────────────────────────
_engine = None
_SessionLocal: sessionmaker | None = None


def get_engine():
    global _engine
    if _engine is None:
        url = settings.database_url
        if not url:
            raise RuntimeError("DATABASE_URL is not set in environment")
        # Force psycopg2 driver — replace postgresql:// and postgres:// schemes
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        is_local = "localhost" in url or "127.0.0.1" in url
        connect_args = {} if is_local else {"sslmode": "require"}
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=2,
            max_overflow=0,
            pool_timeout=30,
            connect_args=connect_args,
        )
    return _engine


def get_session() -> Session:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autocommit=False, autoflush=False)
    return _SessionLocal()


def plan_to_camel(plan: Plan) -> dict[str, Any]:
    """Convert a Plan ORM row to the camelCase dict engine/validator expect."""
    return {
        "id": plan.id,
        "insurerId": plan.insurer_id,
        "insurerName": plan.insurer_name,
        "planName": plan.plan_name,
        "category": plan.category,
        "coverageAmount": plan.coverage_amount,
        "premiums": plan.premiums,
        "premiumFrequency": plan.premium_frequency,
        "coverageTerms": plan.coverage_terms,
        "illnessesCovered": plan.illnesses_covered,
        "earlyStageConditions": plan.early_stage_conditions,
        "payoutType": plan.payout_type,
        "keyBenefits": plan.key_benefits,
        "exclusions": plan.exclusions,
        "sourceUrl": plan.source_url,
        "dataAsOf": plan.data_as_of,
        "updatedBadge": plan.updated_badge,
        "changeNotes": plan.change_notes,
        "version": plan.version,
        "scrapedAt": plan.scraped_at,
    }


def source_to_camel(source: Source) -> dict[str, Any]:
    """Convert a Source ORM row to the camelCase dict change_detector expects."""
    return {
        "id": source.id,
        "insurerId": source.insurer_id,
        "label": source.label,
        "url": source.url,
        "type": source.type,
        "planIds": source.plan_ids or [],
        "etag": source.etag,
        "lastModified": source.last_modified,
        "contentHash": source.content_hash,
        "lastChecked": source.last_checked,
        "lastChanged": source.last_changed,
        "status": source.status,
    }


def apply_source_update(source: Source, updated: dict[str, Any]) -> None:
    """Write change_detector's camelCase update dict back to the Source model."""
    source.etag = updated.get("etag")
    source.last_modified = updated.get("lastModified")
    source.content_hash = updated.get("contentHash")
    source.last_checked = updated.get("lastChecked")
    source.last_changed = updated.get("lastChanged")
    source.status = updated.get("status", "ok")
