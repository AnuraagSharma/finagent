"""Per-turn feedback API.

Schema-only this round — the chat UI doesn't yet expose thumbs-up/down buttons. The
endpoints exist so when those buttons land, no backend work is needed and the
analytics dashboard's Likes / Dislikes / Feedback filter immediately come alive.
"""
from __future__ import annotations

import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select

from finagent.api.dependencies.auth import get_user_id_from_headers
from finagent.db.models import AgentInteraction, Feedback


router = APIRouter(prefix="/v1/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    interaction_id: int
    kind: Literal["like", "dislike"]
    comment: str | None = Field(default=None, max_length=2000)


class FeedbackOut(BaseModel):
    id: int
    interaction_id: int
    user_id: str
    kind: str
    comment: str | None
    created_at: dt.datetime


def _session():
    from finagent.api.main import session_factory  # local import to avoid circulars

    return session_factory()


@router.post("", response_model=FeedbackOut)
def post_feedback(
    body: FeedbackCreate,
    user_id: str = Depends(get_user_id_from_headers),
) -> FeedbackOut:
    """Record (or update) a like/dislike on an interaction.

    Idempotent per (user_id, interaction_id): repeated POSTs flip the kind and refresh the
    comment instead of creating duplicate rows. This keeps the analytics counts honest.
    """
    session = _session()
    try:
        interaction = session.get(AgentInteraction, body.interaction_id)
        if interaction is None:
            raise HTTPException(status_code=404, detail="interaction not found")

        existing = session.execute(
            select(Feedback)
            .where(Feedback.interaction_id == body.interaction_id, Feedback.user_id == user_id)
            .order_by(desc(Feedback.created_at))
            .limit(1)
        ).scalar_one_or_none()

        if existing:
            existing.kind = body.kind
            existing.comment = body.comment
            session.commit()
            session.refresh(existing)
            row = existing
        else:
            row = Feedback(
                interaction_id=body.interaction_id,
                user_id=user_id,
                kind=body.kind,
                comment=body.comment,
            )
            session.add(row)
            session.commit()
            session.refresh(row)

        return FeedbackOut(
            id=row.id,
            interaction_id=row.interaction_id,
            user_id=row.user_id,
            kind=row.kind,
            comment=row.comment,
            created_at=row.created_at,
        )
    finally:
        session.close()


@router.get("", response_model=list[FeedbackOut])
def list_feedback(
    thread_id: str | None = None,
    interaction_id: int | None = None,
    _user_id: str = Depends(get_user_id_from_headers),
) -> list[FeedbackOut]:
    """List feedback for a thread or a specific interaction.

    Used by the Sessions detail drawer to badge each turn with the user's thumbs.
    """
    session = _session()
    try:
        stmt = select(Feedback)
        if interaction_id is not None:
            stmt = stmt.where(Feedback.interaction_id == interaction_id)
        if thread_id is not None:
            ids_stmt = select(AgentInteraction.id).where(AgentInteraction.thread_id == thread_id)
            ids = [int(i) for i in session.execute(ids_stmt).scalars()]
            if not ids:
                return []
            stmt = stmt.where(Feedback.interaction_id.in_(ids))
        stmt = stmt.order_by(desc(Feedback.created_at))
        rows = list(session.execute(stmt).scalars())
        return [
            FeedbackOut(
                id=r.id,
                interaction_id=r.interaction_id,
                user_id=r.user_id,
                kind=r.kind,
                comment=r.comment,
                created_at=r.created_at,
            )
            for r in rows
        ]
    finally:
        session.close()
