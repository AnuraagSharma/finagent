from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text
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

    user_id: Mapped[str] = mapped_column(String(128))
    thread_id: Mapped[str] = mapped_column(String(128))

    user_message: Mapped[str] = mapped_column(Text)
    assistant_message: Mapped[str] = mapped_column(Text)

    latency_ms: Mapped[float] = mapped_column(Float)
    model: Mapped[str] = mapped_column(String(128))

