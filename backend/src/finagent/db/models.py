from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ApiRequest(Base):
    __tablename__ = "api_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.UTC))

    user_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    method: Mapped[str] = mapped_column(String(16))
    path: Mapped[str] = mapped_column(String(512))
    status_code: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[float] = mapped_column(Float)


class AgentInteraction(Base):
    __tablename__ = "agent_interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.UTC))

    user_id: Mapped[str] = mapped_column(String(128), index=True)
    thread_id: Mapped[str] = mapped_column(String(128), index=True)

    user_message: Mapped[str] = mapped_column(Text)
    assistant_message: Mapped[str] = mapped_column(Text)

    latency_ms: Mapped[float] = mapped_column(Float)
    model: Mapped[str] = mapped_column(String(128))

    # Token + cost capture (nullable for back-compat with rows written before this column existed).
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Time split: LLM token-streaming time vs tool/exec time. Sum may differ slightly from latency_ms
    # because of overhead (queueing, framing) — that delta is fine and visible in the UI as "Other".
    llm_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exec_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    step_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tool_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Outcome: success | soft_error | hard_error
    status: Mapped[str] = mapped_column(String(16), default="success")
    error_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    error_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Feedback(Base):
    """Per-turn user feedback (thumbs up / down). Schema only this round; the chat UI buttons
    will be added in a follow-up — once those land, rows will start populating and the
    analytics dashboard's Likes/Dislikes columns light up automatically."""

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.UTC))

    interaction_id: Mapped[int] = mapped_column(ForeignKey("agent_interactions.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # "like" | "dislike"
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
