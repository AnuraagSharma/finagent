"""Admin analytics endpoints powering the /analytics dashboard.

All routes are gated by `require_admin`. With `ADMIN_USER_IDS` empty in env (the demo
default) every user with a valid `X-User-Id` passes — flip the env var later to lock
this down without touching code.

Surface mirrors the dashboard tabs:

- `GET /v1/analytics/summary`         → KPI cards + top recurring errors + response-time trend
- `GET /v1/analytics/users`           → highlight cards + per-user activity rows
- `GET /v1/analytics/turns`           → paged + sortable turn log
- `GET /v1/analytics/sessions`        → per-thread aggregations
- `GET /v1/analytics/sessions/{id}`   → full transcript for one thread
- `GET /v1/analytics/trends`          → series for area + spike charts
- `GET /v1/analytics/export.csv`      → CSV download of the active tab
"""
from __future__ import annotations

import csv
import datetime as dt
import io
from collections.abc import Iterable
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import and_, case, exists, func, select
from sqlalchemy.orm import Session

from finagent.api.dependencies.admin import require_admin
from finagent.api.v1.routes._cache import ttl_cache
from finagent.db.models import AgentInteraction, Feedback
from finagent.infra.config.pricing import compute_cost, estimate_cost_from_messages

# How long an analytics response is reusable. Short enough that the dashboard
# still feels live; long enough that the 15s background poll, tab flips, and
# back-to-back filter tweaks come from memory instead of the database.
_ANALYTICS_TTL = 8.0


router = APIRouter(prefix="/v1/analytics", tags=["analytics"])


# ---------- Shared filters ----------


StatusFilter = Literal["all", "success", "soft_error", "hard_error"]
FeedbackFilter = Literal["all", "like", "dislike", "none"]


def _common_filters(
    from_: dt.datetime | None,
    to: dt.datetime | None,
    status: StatusFilter,
    error_type: str | None,
    user_id: str | None,
    feedback: FeedbackFilter,
) -> list[Any]:
    """Build a list of SQLAlchemy where-clause expressions matching the dashboard filter bar."""
    clauses: list[Any] = []
    if from_:
        clauses.append(AgentInteraction.created_at >= from_)
    if to:
        clauses.append(AgentInteraction.created_at <= to)
    if status != "all":
        clauses.append(AgentInteraction.status == status)
    if error_type:
        clauses.append(AgentInteraction.error_type == error_type)
    if user_id:
        clauses.append(AgentInteraction.user_id == user_id)
    if feedback != "all":
        fb_exists = exists(
            select(1).where(Feedback.interaction_id == AgentInteraction.id)
        )
        if feedback == "none":
            clauses.append(~fb_exists)
        elif feedback == "like":
            clauses.append(
                exists(
                    select(1).where(
                        Feedback.interaction_id == AgentInteraction.id,
                        Feedback.kind == "like",
                    )
                )
            )
        elif feedback == "dislike":
            clauses.append(
                exists(
                    select(1).where(
                        Feedback.interaction_id == AgentInteraction.id,
                        Feedback.kind == "dislike",
                    )
                )
            )
    return clauses


def _session() -> Session:
    """Open a new SQLAlchemy session bound to the app's session factory."""
    from finagent.api.main import session_factory  # local import to avoid circulars

    return session_factory()


def _row_cost(row: AgentInteraction) -> float:
    """Use the persisted cost when present; otherwise fall back to a rough estimate so the
    dashboard still shows something for legacy rows that pre-date token capture."""
    if row.cost_usd is not None:
        return float(row.cost_usd)
    return estimate_cost_from_messages(row.model, row.user_message, row.assistant_message)


def _parse_dt(s: str | None) -> dt.datetime | None:
    if not s:
        return None
    try:
        # Accept either ISO with Z or naive — store all timestamps as UTC-aware.
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        d = dt.datetime.fromisoformat(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.UTC)
        return d
    except Exception:
        return None


# ---------- Schemas ----------


class TopError(BaseModel):
    error_type: str | None
    count: int
    sample_detail: str | None


class TrendPoint(BaseModel):
    bucket: str  # ISO date or week/month label
    queries: int
    avg_latency_ms: float | None
    avg_tokens: float | None
    total_cost_usd: float | None


class SummaryResponse(BaseModel):
    total_queries: int
    sessions: int
    unique_users: int
    success_rate: float  # 0..1
    hard_errors: int
    soft_errors: int
    total_cost_usd: float
    avg_cost_usd: float
    avg_latency_ms: float | None
    avg_llm_ms: float | None
    avg_exec_ms: float | None
    avg_tokens: float | None
    blended_per_million: float | None  # $ per 1M tokens, blended
    top_errors: list[TopError]
    response_time_trend: list[TrendPoint]


class UserActivityRow(BaseModel):
    user_id: str
    questions: int
    sessions: int
    cost_usd: float
    avg_dur_ms: float | None
    likes: int
    dislikes: int
    last_active: dt.datetime | None


class UsersResponse(BaseModel):
    active_users: int
    top_user: str | None
    top_user_questions: int
    avg_questions_per_user: float
    total_questions: int
    power_users: int  # >10 questions
    users: list[UserActivityRow]


class TurnRow(BaseModel):
    id: int
    created_at: dt.datetime
    user_id: str
    thread_id: str
    user_message: str
    assistant_message: str
    status: str
    error_type: str | None
    error_detail: str | None
    latency_ms: float | None
    llm_ms: float | None
    exec_ms: float | None
    step_count: int | None
    tool_count: int | None
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    cost_usd: float | None
    model: str
    likes: int
    dislikes: int


class TurnsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    rows: list[TurnRow]


class SessionRow(BaseModel):
    thread_id: str
    user_id: str
    turns: int
    total_cost_usd: float
    total_duration_ms: float | None
    first_active: dt.datetime | None
    last_active: dt.datetime | None
    first_message: str | None


class SessionsResponse(BaseModel):
    total: int
    rows: list[SessionRow]


class SessionDetailResponse(BaseModel):
    thread_id: str
    user_id: str | None
    turns: list[TurnRow]


class TrendsResponse(BaseModel):
    granularity: str
    points: list[TrendPoint]


# ---------- Helpers ----------


def _bucket_key(d: dt.datetime, granularity: str) -> str:
    if granularity == "weekly":
        iso = d.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    if granularity == "monthly":
        return d.strftime("%Y-%m")
    return d.strftime("%Y-%m-%d")


def _agg_trends(rows: list[AgentInteraction], granularity: str) -> list[TrendPoint]:
    buckets: dict[str, dict[str, float]] = {}
    for r in rows:
        key = _bucket_key(r.created_at, granularity)
        b = buckets.setdefault(key, {"q": 0.0, "lat": 0.0, "lat_n": 0.0, "tok": 0.0, "tok_n": 0.0, "cost": 0.0})
        b["q"] += 1
        if r.latency_ms is not None:
            b["lat"] += r.latency_ms
            b["lat_n"] += 1
        if r.total_tokens:
            b["tok"] += r.total_tokens
            b["tok_n"] += 1
        b["cost"] += _row_cost(r)
    out: list[TrendPoint] = []
    for key in sorted(buckets):
        b = buckets[key]
        out.append(
            TrendPoint(
                bucket=key,
                queries=int(b["q"]),
                avg_latency_ms=(b["lat"] / b["lat_n"]) if b["lat_n"] else None,
                avg_tokens=(b["tok"] / b["tok_n"]) if b["tok_n"] else None,
                total_cost_usd=round(b["cost"], 6),
            )
        )
    return out


def _feedback_counts(session: Session, interaction_ids: Iterable[int]) -> dict[int, dict[str, int]]:
    """For a set of interaction ids, return {id: {likes, dislikes}}."""
    ids = list(interaction_ids)
    if not ids:
        return {}
    rows = session.execute(
        select(Feedback.interaction_id, Feedback.kind, func.count())
        .where(Feedback.interaction_id.in_(ids))
        .group_by(Feedback.interaction_id, Feedback.kind)
    ).all()
    out: dict[int, dict[str, int]] = {}
    for iid, kind, count in rows:
        d = out.setdefault(int(iid), {"likes": 0, "dislikes": 0})
        if kind == "like":
            d["likes"] = int(count)
        elif kind == "dislike":
            d["dislikes"] = int(count)
    return out


# ---------- Routes ----------


@ttl_cache(ttl=_ANALYTICS_TTL, namespace="analytics.summary")
def _compute_summary(
    from_: str | None,
    to: str | None,
    status: StatusFilter,
    error_type: str | None,
    user_id: str | None,
    feedback: FeedbackFilter,
    granularity: str,
) -> SummaryResponse:
    """The actual summary computation — pushed into SQL aggregates so it
    scales past a few thousand interactions. Cached for `_ANALYTICS_TTL` so
    the live-refresh poll & tab flicker don't re-hit the database."""
    session = _session()
    try:
        clauses = _common_filters(_parse_dt(from_), _parse_dt(to), status, error_type, user_id, feedback)
        where = and_(*clauses) if clauses else None

        # ------- One scalar aggregate query for the headline KPIs -------
        # Cost is summed in two passes:
        #   * SQL `SUM(cost_usd)` covers rows where the column is populated
        #     (the modern path — captured at write time).
        #   * Legacy rows (cost_usd IS NULL) are pulled separately and run
        #     through `estimate_cost_from_messages` so the dashboard total
        #     matches the previous behaviour exactly. Almost always empty
        #     in production.
        agg_q = select(
            func.count(AgentInteraction.id).label("total_queries"),
            func.count(func.distinct(AgentInteraction.thread_id)).label("sessions"),
            func.count(func.distinct(AgentInteraction.user_id)).label("unique_users"),
            func.sum(
                case((AgentInteraction.status == "hard_error", 1), else_=0)
            ).label("hard"),
            func.sum(
                case((AgentInteraction.status == "soft_error", 1), else_=0)
            ).label("soft"),
            func.coalesce(func.sum(AgentInteraction.cost_usd), 0.0).label("captured_cost"),
            func.avg(AgentInteraction.latency_ms).label("avg_latency"),
            func.avg(AgentInteraction.llm_ms).label("avg_llm"),
            func.avg(AgentInteraction.exec_ms).label("avg_exec"),
            func.avg(AgentInteraction.total_tokens).label("avg_tokens"),
            func.coalesce(func.sum(AgentInteraction.total_tokens), 0).label("sum_tokens"),
        )
        if where is not None:
            agg_q = agg_q.where(where)
        agg = session.execute(agg_q).one()

        total_queries = int(agg.total_queries or 0)
        sessions_count = int(agg.sessions or 0)
        unique_users = int(agg.unique_users or 0)
        hard = int(agg.hard or 0)
        soft = int(agg.soft or 0)
        success = total_queries - hard - soft
        success_rate = (success / total_queries) if total_queries else 0.0
        captured_cost = float(agg.captured_cost or 0.0)

        # Legacy rows fall back to a token-count estimate. We only need the
        # three columns the estimator reads, so this is small even at scale.
        legacy_q = select(
            AgentInteraction.model,
            AgentInteraction.user_message,
            AgentInteraction.assistant_message,
        ).where(AgentInteraction.cost_usd.is_(None))
        if where is not None:
            legacy_q = legacy_q.where(where)
        legacy_cost = 0.0
        for model, um, am in session.execute(legacy_q).all():
            legacy_cost += estimate_cost_from_messages(model, um or "", am or "")

        total_cost = round(captured_cost + legacy_cost, 6)
        avg_cost = round((total_cost / total_queries), 6) if total_queries else 0.0
        avg_latency = float(agg.avg_latency) if agg.avg_latency is not None else None
        avg_llm = float(agg.avg_llm) if agg.avg_llm is not None else None
        avg_exec = float(agg.avg_exec) if agg.avg_exec is not None else None
        avg_tokens = float(agg.avg_tokens) if agg.avg_tokens is not None else None
        sum_tokens = int(agg.sum_tokens or 0)
        blended = None
        if sum_tokens > 0 and total_cost > 0:
            blended = round(total_cost / (sum_tokens / 1_000_000.0), 4)

        # ------- Top recurring errors (GROUP BY in SQL, top-8) -------
        err_q = (
            select(
                AgentInteraction.error_type,
                func.count(AgentInteraction.id).label("c"),
            )
            .where(AgentInteraction.error_type.is_not(None))
            .where(AgentInteraction.status != "success")
            .group_by(AgentInteraction.error_type)
            .order_by(func.count(AgentInteraction.id).desc())
            .limit(8)
        )
        if where is not None:
            err_q = err_q.where(where)
        err_groups = session.execute(err_q).all()

        top_errors: list[TopError] = []
        for et, count in err_groups:
            # Pull a representative detail string *within the active filter
            # window* so the sample matches the rest of the dashboard. Cheap
            # — one indexed lookup per top error, max 8.
            sample_q = (
                select(AgentInteraction.error_detail)
                .where(AgentInteraction.error_type == et)
                .where(AgentInteraction.error_detail.is_not(None))
                .limit(1)
            )
            if where is not None:
                sample_q = sample_q.where(where)
            sample = session.execute(sample_q).scalar()
            top_errors.append(TopError(error_type=et, count=int(count), sample_detail=sample))

        # ------- Response-time trend buckets -------
        # We still pull just the rows we need (created_at + latency_ms) and
        # bucket in Python — this is far cheaper than the previous full-row
        # load and keeps date-bucketing portable across SQLite/Postgres.
        trend_q = select(
            AgentInteraction.created_at,
            AgentInteraction.latency_ms,
            AgentInteraction.total_tokens,
            AgentInteraction.cost_usd,
        )
        if where is not None:
            trend_q = trend_q.where(where)
        trend_rows = session.execute(trend_q).all()

        buckets: dict[str, dict[str, float]] = {}
        for created_at, latency_ms, total_tok, cost in trend_rows:
            key = _bucket_key(created_at, granularity)
            b = buckets.setdefault(
                key, {"q": 0.0, "lat": 0.0, "lat_n": 0.0, "tok": 0.0, "tok_n": 0.0, "cost": 0.0}
            )
            b["q"] += 1
            if latency_ms is not None:
                b["lat"] += float(latency_ms)
                b["lat_n"] += 1
            if total_tok:
                b["tok"] += float(total_tok)
                b["tok_n"] += 1
            if cost is not None:
                b["cost"] += float(cost)
        trend = [
            TrendPoint(
                bucket=key,
                queries=int(b["q"]),
                avg_latency_ms=(b["lat"] / b["lat_n"]) if b["lat_n"] else None,
                avg_tokens=(b["tok"] / b["tok_n"]) if b["tok_n"] else None,
                total_cost_usd=round(b["cost"], 6),
            )
            for key, b in sorted(buckets.items())
        ]

        return SummaryResponse(
            total_queries=total_queries,
            sessions=sessions_count,
            unique_users=unique_users,
            success_rate=success_rate,
            hard_errors=hard,
            soft_errors=soft,
            total_cost_usd=total_cost,
            avg_cost_usd=avg_cost,
            avg_latency_ms=avg_latency,
            avg_llm_ms=avg_llm,
            avg_exec_ms=avg_exec,
            avg_tokens=avg_tokens,
            blended_per_million=blended,
            top_errors=top_errors,
            response_time_trend=trend,
        )
    finally:
        session.close()


@router.get("/summary", response_model=SummaryResponse)
def summary(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    status: StatusFilter = Query(default="all"),
    error_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    feedback: FeedbackFilter = Query(default="all"),
    granularity: Literal["daily", "weekly", "monthly"] = Query(default="daily"),
    _admin: str = Depends(require_admin),
) -> SummaryResponse:
    """Top-of-page KPIs + Top Recurring Errors + Response Time Trend."""
    return _compute_summary(from_, to, status, error_type, user_id, feedback, granularity)


@ttl_cache(ttl=_ANALYTICS_TTL, namespace="analytics.users")
def _compute_users(
    from_: str | None,
    to: str | None,
    status: StatusFilter,
    error_type: str | None,
    user_id: str | None,
    feedback: FeedbackFilter,
) -> UsersResponse:
    session = _session()
    try:
        clauses = _common_filters(_parse_dt(from_), _parse_dt(to), status, error_type, user_id, feedback)
        rows: list[AgentInteraction] = list(
            session.execute(select(AgentInteraction).where(and_(*clauses)) if clauses else select(AgentInteraction)).scalars()
        )

        # Aggregate per user.
        per_user: dict[str, dict[str, Any]] = {}
        for r in rows:
            u = per_user.setdefault(
                r.user_id,
                {"questions": 0, "sessions": set(), "cost": 0.0, "lat": 0.0, "lat_n": 0, "last": None, "ids": []},
            )
            u["questions"] += 1
            u["sessions"].add(r.thread_id)
            u["cost"] += _row_cost(r)
            if r.latency_ms is not None:
                u["lat"] += r.latency_ms
                u["lat_n"] += 1
            u["ids"].append(r.id)
            last = u["last"]
            u["last"] = r.created_at if (last is None or r.created_at > last) else last

        # Pull feedback counts in one query.
        all_ids: list[int] = [iid for u in per_user.values() for iid in u["ids"]]
        fb = _feedback_counts(session, all_ids)

        rows_out: list[UserActivityRow] = []
        for uid, u in per_user.items():
            likes = sum(fb.get(iid, {}).get("likes", 0) for iid in u["ids"])
            dislikes = sum(fb.get(iid, {}).get("dislikes", 0) for iid in u["ids"])
            rows_out.append(
                UserActivityRow(
                    user_id=uid,
                    questions=int(u["questions"]),
                    sessions=len(u["sessions"]),
                    cost_usd=round(float(u["cost"]), 6),
                    avg_dur_ms=(u["lat"] / u["lat_n"]) if u["lat_n"] else None,
                    likes=likes,
                    dislikes=dislikes,
                    last_active=u["last"],
                )
            )
        rows_out.sort(key=lambda r: r.questions, reverse=True)

        active_users = sum(1 for r in rows_out if r.questions >= 1)
        power_users = sum(1 for r in rows_out if r.questions > 10)
        total_questions = sum(r.questions for r in rows_out)
        avg_q = (total_questions / active_users) if active_users else 0.0
        top_user = rows_out[0].user_id if rows_out else None
        top_q = rows_out[0].questions if rows_out else 0

        return UsersResponse(
            active_users=active_users,
            top_user=top_user,
            top_user_questions=top_q,
            avg_questions_per_user=round(avg_q, 2),
            total_questions=total_questions,
            power_users=power_users,
            users=rows_out,
        )
    finally:
        session.close()


@router.get("/users", response_model=UsersResponse)
def users(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    status: StatusFilter = Query(default="all"),
    error_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    feedback: FeedbackFilter = Query(default="all"),
    _admin: str = Depends(require_admin),
) -> UsersResponse:
    """Per-user activity table. Cached for `_ANALYTICS_TTL` seconds."""
    return _compute_users(from_, to, status, error_type, user_id, feedback)


@router.get("/turns", response_model=TurnsResponse)
def turns(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    status: StatusFilter = Query(default="all"),
    error_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    feedback: FeedbackFilter = Query(default="all"),
    sort: Literal[
        "created_at", "latency_ms", "total_tokens", "cost_usd", "step_count", "tool_count"
    ] = Query(default="created_at"),
    direction: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    _admin: str = Depends(require_admin),
) -> TurnsResponse:
    session = _session()
    try:
        clauses = _common_filters(_parse_dt(from_), _parse_dt(to), status, error_type, user_id, feedback)
        base = select(AgentInteraction)
        if clauses:
            base = base.where(and_(*clauses))

        # Total count for the pager.
        count_q = select(func.count()).select_from(AgentInteraction)
        if clauses:
            count_q = count_q.where(and_(*clauses))
        total = int(session.execute(count_q).scalar() or 0)

        sort_col = {
            "created_at": AgentInteraction.created_at,
            "latency_ms": AgentInteraction.latency_ms,
            "total_tokens": AgentInteraction.total_tokens,
            "cost_usd": AgentInteraction.cost_usd,
            "step_count": AgentInteraction.step_count,
            "tool_count": AgentInteraction.tool_count,
        }[sort]
        order = sort_col.desc() if direction == "desc" else sort_col.asc()

        page_rows: list[AgentInteraction] = list(
            session.execute(base.order_by(order).offset((page - 1) * page_size).limit(page_size)).scalars()
        )

        ids = [r.id for r in page_rows]
        fb = _feedback_counts(session, ids)

        rows_out: list[TurnRow] = []
        for r in page_rows:
            counts = fb.get(r.id, {"likes": 0, "dislikes": 0})
            cost = r.cost_usd if r.cost_usd is not None else compute_cost(r.model, r.prompt_tokens, r.completion_tokens)
            rows_out.append(
                TurnRow(
                    id=r.id,
                    created_at=r.created_at,
                    user_id=r.user_id,
                    thread_id=r.thread_id,
                    user_message=r.user_message or "",
                    assistant_message=r.assistant_message or "",
                    status=r.status or "success",
                    error_type=r.error_type,
                    error_detail=r.error_detail,
                    latency_ms=r.latency_ms,
                    llm_ms=r.llm_ms,
                    exec_ms=r.exec_ms,
                    step_count=r.step_count,
                    tool_count=r.tool_count,
                    prompt_tokens=r.prompt_tokens,
                    completion_tokens=r.completion_tokens,
                    total_tokens=r.total_tokens,
                    cost_usd=cost,
                    model=r.model,
                    likes=counts["likes"],
                    dislikes=counts["dislikes"],
                )
            )

        return TurnsResponse(total=total, page=page, page_size=page_size, rows=rows_out)
    finally:
        session.close()


@ttl_cache(ttl=_ANALYTICS_TTL, namespace="analytics.sessions")
def _compute_sessions(
    from_: str | None,
    to: str | None,
    status: StatusFilter,
    error_type: str | None,
    user_id: str | None,
    page: int,
    page_size: int,
) -> SessionsResponse:
    session = _session()
    try:
        clauses = _common_filters(_parse_dt(from_), _parse_dt(to), status, error_type, user_id, "all")
        rows: list[AgentInteraction] = list(
            session.execute(select(AgentInteraction).where(and_(*clauses)) if clauses else select(AgentInteraction)).scalars()
        )

        groups: dict[str, dict[str, Any]] = {}
        for r in rows:
            g = groups.setdefault(
                r.thread_id,
                {
                    "user_id": r.user_id,
                    "turns": 0,
                    "cost": 0.0,
                    "dur": 0.0,
                    "first": r.created_at,
                    "last": r.created_at,
                    "first_msg": None,
                    "first_msg_at": None,
                },
            )
            g["turns"] += 1
            g["cost"] += _row_cost(r)
            if r.latency_ms is not None:
                g["dur"] += r.latency_ms
            if r.created_at < g["first"]:
                g["first"] = r.created_at
            if r.created_at > g["last"]:
                g["last"] = r.created_at
            if g["first_msg_at"] is None or r.created_at < g["first_msg_at"]:
                g["first_msg_at"] = r.created_at
                g["first_msg"] = r.user_message

        rows_out = [
            SessionRow(
                thread_id=tid,
                user_id=g["user_id"],
                turns=int(g["turns"]),
                total_cost_usd=round(float(g["cost"]), 6),
                total_duration_ms=float(g["dur"]) if g["dur"] else None,
                first_active=g["first"],
                last_active=g["last"],
                first_message=(g["first_msg"][:140] if g["first_msg"] else None),
            )
            for tid, g in groups.items()
        ]
        rows_out.sort(key=lambda r: r.last_active or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)
        total = len(rows_out)
        start = (page - 1) * page_size
        return SessionsResponse(total=total, rows=rows_out[start : start + page_size])
    finally:
        session.close()


@router.get("/sessions", response_model=SessionsResponse)
def sessions(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    status: StatusFilter = Query(default="all"),
    error_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    _admin: str = Depends(require_admin),
) -> SessionsResponse:
    """Per-thread session table. Cached for `_ANALYTICS_TTL` seconds."""
    return _compute_sessions(from_, to, status, error_type, user_id, page, page_size)


@router.get("/sessions/{thread_id}", response_model=SessionDetailResponse)
def session_detail(
    thread_id: str,
    _admin: str = Depends(require_admin),
) -> SessionDetailResponse:
    session = _session()
    try:
        rows: list[AgentInteraction] = list(
            session.execute(
                select(AgentInteraction).where(AgentInteraction.thread_id == thread_id).order_by(AgentInteraction.created_at.asc())
            ).scalars()
        )
        if not rows:
            raise HTTPException(status_code=404, detail="thread not found")
        ids = [r.id for r in rows]
        fb = _feedback_counts(session, ids)
        turns_out: list[TurnRow] = []
        for r in rows:
            counts = fb.get(r.id, {"likes": 0, "dislikes": 0})
            cost = r.cost_usd if r.cost_usd is not None else compute_cost(r.model, r.prompt_tokens, r.completion_tokens)
            turns_out.append(
                TurnRow(
                    id=r.id,
                    created_at=r.created_at,
                    user_id=r.user_id,
                    thread_id=r.thread_id,
                    user_message=r.user_message or "",
                    assistant_message=r.assistant_message or "",
                    status=r.status or "success",
                    error_type=r.error_type,
                    error_detail=r.error_detail,
                    latency_ms=r.latency_ms,
                    llm_ms=r.llm_ms,
                    exec_ms=r.exec_ms,
                    step_count=r.step_count,
                    tool_count=r.tool_count,
                    prompt_tokens=r.prompt_tokens,
                    completion_tokens=r.completion_tokens,
                    total_tokens=r.total_tokens,
                    cost_usd=cost,
                    model=r.model,
                    likes=counts["likes"],
                    dislikes=counts["dislikes"],
                )
            )
        return SessionDetailResponse(thread_id=thread_id, user_id=rows[0].user_id, turns=turns_out)
    finally:
        session.close()


@ttl_cache(ttl=_ANALYTICS_TTL, namespace="analytics.trends")
def _compute_trends(
    from_: str | None,
    to: str | None,
    status: StatusFilter,
    error_type: str | None,
    user_id: str | None,
    granularity: str,
) -> TrendsResponse:
    session = _session()
    try:
        clauses = _common_filters(_parse_dt(from_), _parse_dt(to), status, error_type, user_id, "all")
        # Pull just the columns we actually use for bucketing (cheaper than
        # hydrating full ORM objects).
        cols_q = select(
            AgentInteraction.created_at,
            AgentInteraction.latency_ms,
            AgentInteraction.total_tokens,
            AgentInteraction.cost_usd,
        )
        if clauses:
            cols_q = cols_q.where(and_(*clauses))
        cols_rows = session.execute(cols_q).all()

        buckets: dict[str, dict[str, float]] = {}
        for created_at, latency_ms, total_tok, cost in cols_rows:
            key = _bucket_key(created_at, granularity)
            b = buckets.setdefault(
                key, {"q": 0.0, "lat": 0.0, "lat_n": 0.0, "tok": 0.0, "tok_n": 0.0, "cost": 0.0}
            )
            b["q"] += 1
            if latency_ms is not None:
                b["lat"] += float(latency_ms)
                b["lat_n"] += 1
            if total_tok:
                b["tok"] += float(total_tok)
                b["tok_n"] += 1
            if cost is not None:
                b["cost"] += float(cost)
        points = [
            TrendPoint(
                bucket=key,
                queries=int(b["q"]),
                avg_latency_ms=(b["lat"] / b["lat_n"]) if b["lat_n"] else None,
                avg_tokens=(b["tok"] / b["tok_n"]) if b["tok_n"] else None,
                total_cost_usd=round(b["cost"], 6),
            )
            for key, b in sorted(buckets.items())
        ]
        return TrendsResponse(granularity=granularity, points=points)
    finally:
        session.close()


@router.get("/trends", response_model=TrendsResponse)
def trends(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    status: StatusFilter = Query(default="all"),
    error_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    granularity: Literal["daily", "weekly", "monthly"] = Query(default="daily"),
    _admin: str = Depends(require_admin),
) -> TrendsResponse:
    """Time-bucketed trend series. Cached for `_ANALYTICS_TTL` seconds."""
    return _compute_trends(from_, to, status, error_type, user_id, granularity)


@router.get("/export.csv")
def export_csv(
    tab: Literal["turns", "users", "sessions"] = Query(default="turns"),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    status: StatusFilter = Query(default="all"),
    error_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    feedback: FeedbackFilter = Query(default="all"),
    _admin: str = Depends(require_admin),
) -> StreamingResponse:
    """Stream a CSV of the current filtered view of the chosen tab."""
    session = _session()
    try:
        clauses = _common_filters(_parse_dt(from_), _parse_dt(to), status, error_type, user_id, feedback)
        rows: list[AgentInteraction] = list(
            session.execute(select(AgentInteraction).where(and_(*clauses)) if clauses else select(AgentInteraction)).scalars()
        )
        ids = [r.id for r in rows]
        fb = _feedback_counts(session, ids)

        buf = io.StringIO()
        w = csv.writer(buf)

        if tab == "turns":
            w.writerow(
                [
                    "id", "created_at", "user_id", "thread_id", "model", "status", "error_type",
                    "latency_ms", "llm_ms", "exec_ms", "step_count", "tool_count",
                    "prompt_tokens", "completion_tokens", "total_tokens", "cost_usd",
                    "likes", "dislikes", "user_message", "assistant_message",
                ]
            )
            for r in rows:
                c = fb.get(r.id, {"likes": 0, "dislikes": 0})
                w.writerow(
                    [
                        r.id, r.created_at.isoformat(), r.user_id, r.thread_id, r.model, r.status, r.error_type or "",
                        r.latency_ms or "", r.llm_ms or "", r.exec_ms or "", r.step_count or "", r.tool_count or "",
                        r.prompt_tokens or "", r.completion_tokens or "", r.total_tokens or "",
                        r.cost_usd if r.cost_usd is not None else _row_cost(r),
                        c["likes"], c["dislikes"],
                        (r.user_message or "").replace("\n", " "), (r.assistant_message or "").replace("\n", " "),
                    ]
                )
        elif tab == "users":
            agg: dict[str, dict[str, Any]] = {}
            for r in rows:
                a = agg.setdefault(r.user_id, {"q": 0, "s": set(), "cost": 0.0, "lat": 0.0, "lat_n": 0, "last": None, "ids": []})
                a["q"] += 1
                a["s"].add(r.thread_id)
                a["cost"] += _row_cost(r)
                if r.latency_ms is not None:
                    a["lat"] += r.latency_ms
                    a["lat_n"] += 1
                a["ids"].append(r.id)
                a["last"] = r.created_at if (a["last"] is None or r.created_at > a["last"]) else a["last"]
            w.writerow(["user_id", "questions", "sessions", "cost_usd", "avg_dur_ms", "likes", "dislikes", "last_active"])
            for uid, a in sorted(agg.items(), key=lambda kv: kv[1]["q"], reverse=True):
                likes = sum(fb.get(iid, {}).get("likes", 0) for iid in a["ids"])
                dislikes = sum(fb.get(iid, {}).get("dislikes", 0) for iid in a["ids"])
                w.writerow(
                    [
                        uid, a["q"], len(a["s"]), round(a["cost"], 6),
                        (a["lat"] / a["lat_n"]) if a["lat_n"] else "",
                        likes, dislikes, a["last"].isoformat() if a["last"] else "",
                    ]
                )
        else:  # sessions
            grp: dict[str, dict[str, Any]] = {}
            for r in rows:
                g = grp.setdefault(
                    r.thread_id,
                    {"u": r.user_id, "t": 0, "cost": 0.0, "dur": 0.0, "first": r.created_at, "last": r.created_at, "msg": r.user_message},
                )
                g["t"] += 1
                g["cost"] += _row_cost(r)
                if r.latency_ms is not None:
                    g["dur"] += r.latency_ms
                if r.created_at < g["first"]:
                    g["first"] = r.created_at
                    g["msg"] = r.user_message
                if r.created_at > g["last"]:
                    g["last"] = r.created_at
            w.writerow(["thread_id", "user_id", "turns", "total_cost_usd", "total_duration_ms", "first_active", "last_active", "first_message"])
            for tid, g in sorted(grp.items(), key=lambda kv: kv[1]["last"], reverse=True):
                w.writerow(
                    [
                        tid, g["u"], g["t"], round(float(g["cost"]), 6),
                        float(g["dur"]) if g["dur"] else "",
                        g["first"].isoformat(), g["last"].isoformat(),
                        (g["msg"] or "").replace("\n", " ")[:200],
                    ]
                )

        buf.seek(0)
        filename = f"finagent-analytics-{tab}-{dt.datetime.now(dt.UTC).strftime('%Y%m%d-%H%M%S')}.csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        session.close()
