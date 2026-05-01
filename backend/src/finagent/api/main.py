import time
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from finagent.api.v1.routes.agent import router as agent_router
from finagent.api.v1.routes.analytics import router as analytics_router
from finagent.api.v1.routes.feedback import router as feedback_router
from finagent.db.models import Base, ApiRequest
from finagent.db.postgres import create_pg_engine, create_session_factory, session_scope
from finagent.infra.config.settings import get_settings


app = FastAPI(title="Fin_Agent Backend", version="0.1.0")

settings = get_settings()
engine = create_pg_engine(settings.database_url)
session_factory = create_session_factory(engine)

_DEFAULT_DEV_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys((*_DEFAULT_DEV_ORIGINS, *settings.cors_allow_origins))),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Columns we may need to add to the existing agent_interactions table on demo databases
# that pre-date the analytics work. `Base.metadata.create_all` won't add columns, so we
# do a tiny idempotent ALTER TABLE here. Production setups should use Alembic instead.
_AGENT_INTERACTIONS_NEW_COLUMNS: tuple[tuple[str, str], ...] = (
    ("prompt_tokens", "INTEGER"),
    ("completion_tokens", "INTEGER"),
    ("total_tokens", "INTEGER"),
    ("cost_usd", "DOUBLE PRECISION"),
    ("llm_ms", "DOUBLE PRECISION"),
    ("exec_ms", "DOUBLE PRECISION"),
    ("step_count", "INTEGER"),
    ("tool_count", "INTEGER"),
    ("status", "VARCHAR(16) DEFAULT 'success' NOT NULL"),
    ("error_type", "VARCHAR(64)"),
    ("error_detail", "TEXT"),
)


def _ensure_agent_interactions_columns() -> None:
    inspector = inspect(engine)
    if "agent_interactions" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("agent_interactions")}
    with engine.begin() as conn:
        for name, ddl in _AGENT_INTERACTIONS_NEW_COLUMNS:
            if name in existing:
                continue
            conn.execute(text(f"ALTER TABLE agent_interactions ADD COLUMN IF NOT EXISTS {name} {ddl}"))


# Indexes that materially speed up the analytics dashboard queries. Declared
# here (vs. on the model) so we can apply them to existing demo databases
# without an Alembic migration. CREATE INDEX IF NOT EXISTS makes this idempotent.
_ANALYTICS_INDEXES: tuple[tuple[str, str, str], ...] = (
    # Most filter & ordering paths key off created_at — the single biggest win.
    ("ix_agent_interactions_created_at", "agent_interactions", "(created_at DESC)"),
    # status filter + group-by-status aggregations on /summary.
    ("ix_agent_interactions_status", "agent_interactions", "(status)"),
    # error_type filter + group-by for top-recurring-errors panel.
    ("ix_agent_interactions_error_type", "agent_interactions", "(error_type)"),
    # Composite for the (user_id, created_at desc) pattern on /users.
    ("ix_agent_interactions_user_created", "agent_interactions", "(user_id, created_at DESC)"),
    # Composite for the (thread_id, created_at) pattern on /sessions and detail.
    ("ix_agent_interactions_thread_created", "agent_interactions", "(thread_id, created_at)"),
)


def _ensure_analytics_indexes() -> None:
    """Create supporting indexes on `agent_interactions` if missing. Postgres
    parses `CREATE INDEX IF NOT EXISTS` natively; SQLite does too. The DDL
    runs idempotently so it's safe across every restart."""
    inspector = inspect(engine)
    if "agent_interactions" not in inspector.get_table_names():
        return
    with engine.begin() as conn:
        for name, table, columns in _ANALYTICS_INDEXES:
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {columns}"))


@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_agent_interactions_columns()
    _ensure_analytics_indexes()


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next: Callable[[Request], Response]):
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000.0

    user_id = request.headers.get("X-User-Id")
    try:
        with session_scope(session_factory) as session:
            session.add(
                ApiRequest(
                    user_id=user_id,
                    method=request.method,
                    path=str(request.url.path),
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                )
            )
    except Exception:
        # Never fail requests due to analytics logging
        pass

    return response


app.include_router(agent_router)
app.include_router(analytics_router)
app.include_router(feedback_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
