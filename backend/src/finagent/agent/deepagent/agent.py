from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from deepagents.backends import StateBackend
from langgraph.checkpoint.redis import RedisSaver

from finagent.agent.tools import financial_tools

_HERE = Path(__file__).resolve().parent
_PROMPT_DIR = (_HERE.parent / "prompt").resolve()
_SKILLS_DIR = (_HERE.parent / "skills").resolve()

PROMPT_PLANNER_MD = _PROMPT_DIR / "planner.md"
PROMPT_DATA_PULL_MD = _PROMPT_DIR / "data_pull.md"
PROMPT_ANALYTICS_MD = _PROMPT_DIR / "analytics.md"


def _load_prompt(path: Path, fallback: str) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except Exception:
        return fallback


@dataclass(frozen=True)
class FinAgentRuntimeContext:
    user_id: str


@lru_cache(maxsize=4)
def build_fin_deep_agent(*, redis_url: str, model: str) -> Any:
    """
    Returns a compiled Deep Agent graph.

    Uses Redis for:
    - LangGraph checkpoints (thread persistence)
    - StoreBackend filesystem (agent-written todos/reports) with per-user isolation
    """
    # Use Redis for durable checkpoints (thread persistence).
    # For Upstash, avoid RedisStore because it requires RediSearch (FT.*) commands.
    # StateBackend stores agent-written files (todos/reports) in the graph state, which
    # is checkpointed into Redis — giving us persistence without RedisSearch.
    checkpointer = RedisSaver(redis_url=redis_url)
    checkpointer.setup()

    supervisor_prompt = _load_prompt(
        PROMPT_PLANNER_MD,
        "You are FinAgent, a professional financial research assistant. Be concise and use tools for market data.",
    )
    data_pull_prompt = _load_prompt(
        PROMPT_DATA_PULL_MD,
        "You are the DataPull subagent. Use tools to fetch data and return structured facts.",
    )
    analytics_prompt = _load_prompt(
        PROMPT_ANALYTICS_MD,
        "You are the Analytics subagent. Produce a clear, structured answer from provided facts.",
    )

    data_pull_subagent = {
        "name": "data_pull",
        "description": "Tool-heavy data retrieval specialist. Fetches facts and returns structured output.",
        "system_prompt": data_pull_prompt,
        "tools": list(financial_tools),
        "skills": [str(_SKILLS_DIR)],
    }
    analytics_subagent = {
        "name": "analytics",
        "description": "Analysis specialist. Turns fetched facts into a professional answer.",
        "system_prompt": analytics_prompt,
        "tools": [],
        "skills": [str(_SKILLS_DIR)],
    }

    agent = create_deep_agent(
        model=model,
        tools=list(financial_tools),
        system_prompt=supervisor_prompt,
        memory=[str((_HERE.parent / "AGENTS.md").resolve())],
        subagents=[data_pull_subagent, analytics_subagent],
        skills=[str(_SKILLS_DIR)],
        backend=StateBackend(),
        checkpointer=checkpointer,
        context_schema=FinAgentRuntimeContext,
        # memory/skills/prompts will be added next iteration
        name="finagent",
    )

    return agent

