from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, Float, Integer, JSON, String, Text, create_engine, delete, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/english-ai.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

if DATABASE_URL.startswith("sqlite"):
    Path("data").mkdir(parents=True, exist_ok=True)

if IS_POSTGRES:
    from pgvector.sqlalchemy import Vector
    embedding_type = Vector(32)
else:
    embedding_type = JSON


class Base(DeclarativeBase):
    pass


class Attempt(Base):
    __tablename__ = "english_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(80), index=True)
    target_phrase: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str] = mapped_column(Text)
    correction: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40))
    score: Mapped[int] = mapped_column(Integer)
    content_score: Mapped[int] = mapped_column(Integer)
    delivery_score: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(40))
    issues_json: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    improvement: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Mistake(Base):
    __tablename__ = "english_mistakes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(80), index=True)
    token: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(40))
    heard_as: Mapped[str] = mapped_column(String(160))
    tip: Mapped[str] = mapped_column(Text)
    count: Mapped[int] = mapped_column(Integer, default=1)
    embedding: Mapped[list[float]] = mapped_column(embedding_type)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_options = {"pool_pre_ping": True, "connect_args": connect_args}
if IS_POSTGRES:
    engine_options.update({"pool_size": 5, "max_overflow": 5, "pool_recycle": 300})
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def initialize_database() -> None:
    if IS_POSTGRES:
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)


def mistake_embedding(token: str, category: str) -> list[float]:
    digest = hashlib.sha256(f"{category}:{token}".encode("utf-8")).digest()
    values = [(byte - 127.5) / 127.5 for byte in digest[:32]]
    magnitude = math.sqrt(sum(value * value for value in values)) or 1
    return [round(value / magnitude, 7) for value in values]


def _attempt_dict(attempt: Attempt) -> dict[str, Any]:
    return {
        "id": attempt.id,
        "targetPhrase": attempt.target_phrase,
        "transcript": attempt.transcript,
        "correction": attempt.correction,
        "category": attempt.category,
        "score": attempt.score,
        "contentScore": attempt.content_score,
        "deliveryScore": attempt.delivery_score,
        "durationMs": attempt.duration_ms,
        "source": attempt.source,
        "issues": json.loads(attempt.issues_json),
        "summary": attempt.summary,
        "improvement": attempt.improvement,
        "createdAt": attempt.created_at.isoformat(),
    }


def _mistake_dict(mistake: Mistake) -> dict[str, Any]:
    return {
        "id": mistake.id,
        "word": mistake.token,
        "category": mistake.category,
        "heardAs": mistake.heard_as,
        "tip": mistake.tip,
        "count": mistake.count,
        "lastSeenAt": mistake.last_seen_at.isoformat(),
    }


def record_attempt(session_id: str, result: dict[str, Any], source: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    with SessionLocal.begin() as session:
        previous = session.scalars(
            select(Attempt)
            .where(Attempt.session_id == session_id, Attempt.target_phrase == result["targetPhrase"])
            .order_by(Attempt.created_at.desc())
            .limit(1)
        ).first()
        improvement = result["score"] - previous.score if previous else 0
        attempt = Attempt(
            id=str(uuid4()),
            session_id=session_id,
            target_phrase=result["targetPhrase"],
            transcript=result["transcript"],
            correction=result["correction"],
            category=result["category"],
            score=result["score"],
            content_score=result["contentScore"],
            delivery_score=result["deliveryScore"],
            duration_ms=result["durationMs"],
            source=source,
            issues_json=json.dumps(result["issues"]),
            summary=result["summary"],
            improvement=improvement,
            created_at=now,
        )
        session.add(attempt)

        for issue in result["issues"]:
            token = issue["word"].lower()[:160]
            existing = session.scalars(
                select(Mistake).where(Mistake.session_id == session_id, Mistake.token == token).limit(1)
            ).first()
            if existing:
                existing.count += 1
                existing.heard_as = issue["heardAs"][:160]
                existing.tip = issue["tip"]
                existing.category = issue["category"]
                existing.last_seen_at = now
            else:
                session.add(Mistake(
                    id=str(uuid4()),
                    session_id=session_id,
                    token=token,
                    category=issue["category"],
                    heard_as=issue["heardAs"][:160],
                    tip=issue["tip"],
                    count=1,
                    embedding=mistake_embedding(token, issue["category"]),
                    last_seen_at=now,
                ))

    saved = _attempt_dict(attempt)
    saved["improvement"] = improvement
    return saved


def get_learner_state(session_id: str) -> dict[str, Any]:
    with SessionLocal() as session:
        attempts = list(session.scalars(
            select(Attempt).where(Attempt.session_id == session_id).order_by(Attempt.created_at.desc()).limit(30)
        ))
        mistakes = list(session.scalars(
            select(Mistake).where(Mistake.session_id == session_id).order_by(Mistake.count.desc(), Mistake.last_seen_at.desc()).limit(20)
        ))
    return {
        "attempts": [_attempt_dict(attempt) for attempt in attempts],
        "mistakes": [_mistake_dict(mistake) for mistake in mistakes],
        "stats": {
            "attempts": len(attempts),
            "recurringMistakes": sum(1 for mistake in mistakes if mistake.count > 1),
            "bestScore": max((attempt.score for attempt in attempts), default=0),
            "averageScore": round(sum(attempt.score for attempt in attempts) / len(attempts)) if attempts else 0,
        },
    }


def clear_learner_state(session_id: str) -> None:
    with SessionLocal.begin() as session:
        session.execute(delete(Attempt).where(Attempt.session_id == session_id))
        session.execute(delete(Mistake).where(Mistake.session_id == session_id))


def clear_learner_resource(session_id: str, resource: str, resource_id: str | None = None) -> None:
    with SessionLocal.begin() as session:
        if resource == "attempts":
            statement = delete(Attempt).where(Attempt.session_id == session_id)
            if resource_id:
                statement = statement.where(Attempt.id == resource_id)
            session.execute(statement)
            return
        if resource == "mistake" and resource_id:
            session.execute(delete(Mistake).where(Mistake.session_id == session_id, Mistake.id == resource_id))
