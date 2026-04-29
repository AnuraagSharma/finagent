from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any, Iterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from finagent.agent.deepagent.agent import build_fin_deep_agent
from finagent.api.dependencies.auth import get_user_id_from_headers
from finagent.db.models import AgentInteraction
from finagent.db.postgres import session_scope
from finagent.infra.config.settings import get_settings


router = APIRouter(prefix="/v1/agent", tags=["agent"])


class AgentRunRequest(BaseModel):
    message: str = Field(..., min_length=1)
    thread_id: str | None = None


class AgentRunResponse(BaseModel):
    thread_id: str
    message: str


def _extract_assistant_message(result: dict[str, Any]) -> str:
    messages = result.get("messages") or []
    if not messages:
        return ""
    last = messages[-1]
    content = getattr(last, "content", None)
    if content is None and isinstance(last, dict):
        content = last.get("content", "")
    if isinstance(content, str):
        return content
    # Deep Agents often returns a list of blocks; extract text blocks if present.
    if isinstance(content, list):
        texts: list[str] = []
        for b in content:
            if isinstance(b, dict) and b.get("type") == "text" and isinstance(b.get("text"), str):
                texts.append(b["text"])
        if texts:
            return "\n".join(texts).strip()
    return str(content)


@router.post("/run", response_model=AgentRunResponse)
def run_agent(
    body: AgentRunRequest,
    user_id: str = Depends(get_user_id_from_headers),
) -> AgentRunResponse:
    settings = get_settings()

    thread_id = body.thread_id or str(uuid.uuid4())

    agent = build_fin_deep_agent(redis_url=settings.redis_url, model=settings.openai_model)

    started = time.perf_counter()
    try:
        result = agent.invoke(
            {
                "messages": [{"role": "user", "content": body.message}],
            },
            config={
                "configurable": {"thread_id": thread_id},
                "context": {"user_id": user_id},
            },
        )
    except Exception as e:
        # Surface the underlying error to help with early integration
        raise HTTPException(status_code=500, detail=str(e)) from e
    latency_ms = (time.perf_counter() - started) * 1000.0

    assistant_message = _extract_assistant_message(result)

    # Persist interaction for analytics dashboard
    from finagent.api.main import session_factory  # local import to avoid circulars

    with session_scope(session_factory) as session:
        session.add(
            AgentInteraction(
                user_id=user_id,
                thread_id=thread_id,
                user_message=body.message,
                assistant_message=assistant_message,
                latency_ms=latency_ms,
                model=settings.openai_model,
            )
        )

    return AgentRunResponse(thread_id=thread_id, message=assistant_message)


class ThreadMessage(BaseModel):
    role: str
    text: str


class ThreadHistoryResponse(BaseModel):
    thread_id: str
    messages: list[ThreadMessage]


def _msg_text(msg: Any) -> str:
    """Extract plain text from a LangChain BaseMessage (string or block list)."""
    content = getattr(msg, "content", None)
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for b in content:
            if isinstance(b, dict):
                t = b.get("text")
                if isinstance(t, str):
                    parts.append(t)
            elif isinstance(b, str):
                parts.append(b)
        return "".join(parts).strip()
    return ""


@router.get("/thread/{thread_id}", response_model=ThreadHistoryResponse)
def get_thread(
    thread_id: str,
    user_id: str = Depends(get_user_id_from_headers),
) -> ThreadHistoryResponse:
    """Return prior conversation messages for a thread (used to rehydrate UI on resume)."""
    settings = get_settings()
    agent = build_fin_deep_agent(redis_url=settings.redis_url, model=settings.openai_model)

    try:
        snapshot = agent.get_state(config={"configurable": {"thread_id": thread_id}})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"history error: {e}") from e

    messages_out: list[ThreadMessage] = []
    values = getattr(snapshot, "values", None) or {}
    raw_messages = values.get("messages") if isinstance(values, dict) else None
    if not raw_messages:
        return ThreadHistoryResponse(thread_id=thread_id, messages=[])

    for m in raw_messages:
        mtype = getattr(m, "type", None)
        if mtype == "human":
            text = _msg_text(m)
            if text:
                messages_out.append(ThreadMessage(role="user", text=text))
        elif mtype == "ai":
            # Skip pure tool-call AI messages (no surface text)
            text = _msg_text(m)
            if text:
                messages_out.append(ThreadMessage(role="assistant", text=text))
        # tool/system/function messages are not user-visible — skip

    return ThreadHistoryResponse(thread_id=thread_id, messages=messages_out)


def _sse(event: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n".encode("utf-8")


def _chunk_text(chunk: Any) -> str:
    """Best-effort extract a text token from a LangGraph message chunk."""
    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for b in content:
            if isinstance(b, dict):
                t = b.get("text")
                if isinstance(t, str):
                    parts.append(t)
        return "".join(parts)
    return ""


def _advance_stream_iter(sync_it: Iterator[Any]) -> tuple[Any, bool]:
    """Run next() in a thread-friendly wrapper; returns (item, finished)."""
    try:
        return next(sync_it), False
    except StopIteration:
        return None, True


@router.post("/stream")
async def stream_agent(
    body: AgentRunRequest,
    request: Request,
    user_id: str = Depends(get_user_id_from_headers),
) -> StreamingResponse:
    settings = get_settings()
    thread_id = body.thread_id or str(uuid.uuid4())
    agent = build_fin_deep_agent(redis_url=settings.redis_url, model=settings.openai_model)

    async def sse_gen() -> AsyncIterator[bytes]:
        started = time.perf_counter()
        full_text_parts: list[str] = []
        inflight_tools: dict[str, str] = {}
        yield _sse({"type": "start", "thread_id": thread_id})
        try:
            stream = agent.stream(
                {"messages": [{"role": "user", "content": body.message}]},
                config={
                    "configurable": {"thread_id": thread_id},
                    "context": {"user_id": user_id},
                },
                stream_mode=["messages", "updates"],
            )
            sync_it = iter(stream)
            while True:
                if await request.is_disconnected():
                    return
                item, finished = await asyncio.to_thread(_advance_stream_iter, sync_it)
                if finished:
                    break
                if await request.is_disconnected():
                    return

                if isinstance(item, tuple) and len(item) == 2 and isinstance(item[0], str):
                    mode, payload = item
                else:
                    mode, payload = "messages", item

                if mode == "messages":
                    if isinstance(payload, tuple) and len(payload) >= 2:
                        chunk, metadata = payload[0], payload[1]
                    else:
                        chunk, metadata = payload, {}
                    node = (metadata or {}).get("langgraph_node") if isinstance(metadata, dict) else None
                    if node and "tool" in str(node).lower():
                        continue
                    text = _chunk_text(chunk)
                    if not text:
                        continue
                    full_text_parts.append(text)
                    yield _sse({"type": "token", "text": text})

                elif mode == "updates":
                    if not isinstance(payload, dict):
                        continue
                    for node_name, update in payload.items():
                        if not isinstance(update, dict):
                            continue

                        msgs = update.get("messages") or []
                        if not isinstance(msgs, list):
                            msgs = [msgs]

                        for msg in msgs:
                            tool_calls = getattr(msg, "tool_calls", None) or []
                            if tool_calls:
                                for tc in tool_calls:
                                    if isinstance(tc, dict):
                                        tname = tc.get("name")
                                        tid = tc.get("id")
                                    else:
                                        tname = getattr(tc, "name", None)
                                        tid = getattr(tc, "id", None)
                                    if not tname:
                                        continue
                                    inflight_tools[str(tid)] = str(tname)
                                    kind = "subagent" if tname == "task" else "tool"
                                    yield _sse(
                                        {
                                            "type": "step",
                                            "kind": kind,
                                            "name": tname,
                                            "status": "started",
                                            "id": tid,
                                            "node": node_name,
                                        }
                                    )

                            msg_type = getattr(msg, "type", None)
                            if msg_type == "tool":
                                tid = getattr(msg, "tool_call_id", None)
                                tname = inflight_tools.pop(str(tid), getattr(msg, "name", "tool"))
                                kind = "subagent" if tname == "task" else "tool"
                                yield _sse(
                                    {
                                        "type": "step",
                                        "kind": kind,
                                        "name": tname,
                                        "status": "completed",
                                        "id": tid,
                                        "node": node_name,
                                    }
                                )

                        if "todos" in update:
                            todos_raw = update.get("todos") or []
                            items: list[dict[str, Any]] = []
                            for t in todos_raw:
                                if isinstance(t, dict):
                                    items.append(
                                        {
                                            "content": t.get("content", ""),
                                            "status": t.get("status", "pending"),
                                        }
                                    )
                                else:
                                    items.append(
                                        {
                                            "content": getattr(t, "content", ""),
                                            "status": getattr(t, "status", "pending"),
                                        }
                                    )
                            yield _sse({"type": "todos", "items": items})

            full_text = "".join(full_text_parts).strip()
            latency_ms = (time.perf_counter() - started) * 1000.0

            try:
                from finagent.api.main import session_factory

                with session_scope(session_factory) as session:
                    session.add(
                        AgentInteraction(
                            user_id=user_id,
                            thread_id=thread_id,
                            user_message=body.message,
                            assistant_message=full_text,
                            latency_ms=latency_ms,
                            model=settings.openai_model,
                        )
                    )
            except Exception:
                pass

            yield _sse({"type": "done", "thread_id": thread_id, "ms": int(latency_ms)})
        except Exception as e:  # noqa: BLE001
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        sse_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

