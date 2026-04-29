import time
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from finagent.api.v1.routes.agent import router as agent_router
from finagent.db.models import Base, ApiRequest
from finagent.db.postgres import create_pg_engine, create_session_factory, session_scope
from finagent.infra.config.settings import get_settings


app = FastAPI(title="Fin_Agent Backend", version="0.1.0")

settings = get_settings()
engine = create_pg_engine(settings.database_url)
session_factory = create_session_factory(engine)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins for the frontends we actually run.
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    # Permissive regex so any localhost dev port (3000–8999) works without re-deploys.
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    # Demo-friendly: create tables automatically.
    Base.metadata.create_all(bind=engine)


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


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}

