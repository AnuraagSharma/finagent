from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


def create_pg_engine(database_url: str):
    # Prefer psycopg3 driver (installed via psycopg[binary]).
    # If the URL doesn't specify a driver, SQLAlchemy defaults to psycopg2.
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)

    # Neon requires sslmode=require; URL already includes it.
    return create_engine(database_url, pool_pre_ping=True)


def create_session_factory(engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


@contextmanager
def session_scope(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

