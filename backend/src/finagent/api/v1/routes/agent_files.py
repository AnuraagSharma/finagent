"""Serve files written by the deep-agent's virtual filesystem to the user.

Background: the agent uses `deepagents.backends.StateBackend`, which keeps
files (CSV, JSON, Markdown reports, etc.) in the LangGraph state dict —
*not* on disk. Without these endpoints there's no way for the browser to
download those artifacts; the agent ends up "saving" files into a phantom
/tmp path that no client can reach.

These two routes pull files straight out of the agent's checkpointed state
and stream them back, so the chat UI can render real download chips.
"""
from __future__ import annotations

import io
import mimetypes
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from finagent.api.dependencies.auth import get_user_id_from_headers
from finagent.infra.config.settings import get_settings


router = APIRouter(prefix="/v1/agent/files", tags=["agent-files"])


# ---------- Response schemas ----------


class AgentFile(BaseModel):
    name: str
    size: int  # bytes (or character count for text)
    mime: str


class AgentFilesResponse(BaseModel):
    thread_id: str
    files: list[AgentFile]


# ---------- Helpers ----------


# Filename guard: lock to plain names so a thread can't request "../../etc/..."
# style paths. Allow letters, digits, dot, dash, underscore, and a single
# slash for shallow folders agents sometimes use. No backslashes, no `..`.
_SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9_./\-]+$")

# LangChain emits tool-call ids like `call_wXXu6Bx6EuSnzamlNaC9wCqT` and the
# deepagents StateBackend stashes their results under that name in the state
# `files` dict. They're internal plumbing — not something the user ever asked
# for — so we hide them from the download chip row. We're conservative: only
# match the literal prefix and require no extension, so a user-named file
# called `call_log.txt` would still surface.
_TOOL_CALL_NAME_RE = re.compile(r"^call_[A-Za-z0-9_-]+$")


def _is_safe_filename(name: str) -> bool:
    if not name or len(name) > 255:
        return False
    if ".." in name:
        return False
    return bool(_SAFE_NAME_RE.match(name))


def _is_user_visible_file(name: str) -> bool:
    """Hide internal artifacts (tool-call payloads, dotfiles) from the chip
    row. The list endpoint applies this; the download endpoint does NOT, so
    a power user with a direct URL can still grab one if needed."""
    if _TOOL_CALL_NAME_RE.match(name):
        return False
    leaf = name.rsplit("/", 1)[-1]
    if leaf.startswith("."):
        return False
    return True


def _state_files(snapshot: Any) -> dict[str, Any]:
    """Pull the file dict out of an agent state snapshot.

    deepagents' StateBackend keeps files under the `files` key as
    {filename: content}. We also try `documents` / `artifacts` as a
    safety net in case the upstream library renames the key in a
    future release — better to fall through than silently 404."""
    values = getattr(snapshot, "values", None)
    if not isinstance(values, dict):
        return {}
    for key in ("files", "documents", "artifacts"):
        bag = values.get(key)
        if isinstance(bag, dict):
            return bag
    return {}


def _file_bytes(content: Any) -> bytes:
    """Normalise a stored file's content to bytes for streaming."""
    if isinstance(content, bytes):
        return content
    if isinstance(content, str):
        return content.encode("utf-8")
    if isinstance(content, dict) and "content" in content:
        # Some backends wrap the payload in a metadata dict.
        return _file_bytes(content["content"])
    # Last resort — stringify whatever it is so the user at least gets
    # *something* instead of a 500.
    return str(content).encode("utf-8")


def _guess_mime(name: str) -> str:
    """Best-effort content-type. mimetypes covers the obvious cases; we
    fill in a few that the stdlib mapping misses or gets wrong for our
    typical agent outputs."""
    overrides = {
        ".md": "text/markdown; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".jsonl": "application/x-ndjson; charset=utf-8",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xml": "application/xml; charset=utf-8",
    }
    name_lower = name.lower()
    for suffix, mime in overrides.items():
        if name_lower.endswith(suffix):
            return mime
    guessed, _ = mimetypes.guess_type(name)
    return guessed or "application/octet-stream"


def _build_agent() -> Any:
    """Build (or re-use a cached) agent instance so we can read its state."""
    # Local import keeps module import cheap and avoids circulars at app boot.
    from finagent.agent.deepagent.agent import build_fin_deep_agent

    settings = get_settings()
    return build_fin_deep_agent(
        redis_url=settings.redis_url, model=settings.openai_model
    )


# ---------- Routes ----------


@router.get("/{thread_id}", response_model=AgentFilesResponse)
def list_files(
    thread_id: str,
    _user_id: str = Depends(get_user_id_from_headers),
) -> AgentFilesResponse:
    """List every file the agent wrote for this thread."""
    agent = _build_agent()
    try:
        snapshot = agent.get_state(
            config={"configurable": {"thread_id": thread_id}}
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"state fetch failed: {e}") from e

    bag = _state_files(snapshot)
    files: list[AgentFile] = []
    for name, content in bag.items():
        if not isinstance(name, str):
            continue
        if not _is_user_visible_file(name):
            # Skip internal tool-call payloads and dotfiles — they show up
            # in the StateBackend dict but were never something the user
            # asked the agent to write.
            continue
        try:
            data = _file_bytes(content)
        except Exception:
            continue
        files.append(AgentFile(name=name, size=len(data), mime=_guess_mime(name)))

    # Stable, alphabetical — easier to scan in the chip row.
    files.sort(key=lambda f: f.name.lower())
    return AgentFilesResponse(thread_id=thread_id, files=files)


@router.get("/{thread_id}/{filename:path}")
def download_file(
    thread_id: str,
    filename: str,
    _user_id: str = Depends(get_user_id_from_headers),
) -> StreamingResponse:
    """Stream one file back to the browser as an attachment so the standard
    Save-As dialog opens. Uses `:path` so shallow folder names with a slash
    still work, and validates the result is safe."""
    if not _is_safe_filename(filename):
        raise HTTPException(status_code=400, detail="bad filename")

    agent = _build_agent()
    try:
        snapshot = agent.get_state(
            config={"configurable": {"thread_id": thread_id}}
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"state fetch failed: {e}") from e

    bag = _state_files(snapshot)
    if filename not in bag:
        raise HTTPException(status_code=404, detail="file not found")

    data = _file_bytes(bag[filename])
    mime = _guess_mime(filename)
    # Use just the trailing component of the path for the download name —
    # prevents folder slashes from confusing the browser's Save-As dialog.
    download_as = filename.rsplit("/", 1)[-1]
    headers = {
        # `attachment` is what makes browsers actually download instead of
        # rendering. Wrap the name in quotes for safety with spaces.
        "Content-Disposition": f'attachment; filename="{download_as}"',
        # Prevent caching surprises — agent files are mutable per turn.
        "Cache-Control": "no-store",
    }
    return StreamingResponse(io.BytesIO(data), media_type=mime, headers=headers)
