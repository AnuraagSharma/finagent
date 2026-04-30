"""Per-model pricing for cost analytics.

Rates are USD per 1M tokens, separated into input (prompt) and output (completion).
Model names match LangChain's normalized form ("openai:gpt-5.4" → looked up by both
the full string and the suffix).

Numbers are public list prices at time of writing — easy to override per environment via
`MODEL_PRICING_JSON` env var, e.g.:

    MODEL_PRICING_JSON='{"openai:gpt-5.4":[1.25,5.00]}'
"""
from __future__ import annotations

import json
import os
from functools import lru_cache


_DEFAULT_RATES: dict[str, tuple[float, float]] = {
    # FinAgent default model
    "openai:gpt-5.4": (1.25, 5.00),
    "gpt-5.4": (1.25, 5.00),
    # Common fallbacks so existing rows from earlier experiments still get costed
    "openai:gpt-5": (2.50, 10.00),
    "gpt-5": (2.50, 10.00),
    "openai:gpt-4o": (2.50, 10.00),
    "gpt-4o": (2.50, 10.00),
    "openai:gpt-4o-mini": (0.15, 0.60),
    "gpt-4o-mini": (0.15, 0.60),
    "openai:gpt-4.1": (2.00, 8.00),
    "gpt-4.1": (2.00, 8.00),
}


@lru_cache(maxsize=1)
def _rates() -> dict[str, tuple[float, float]]:
    rates = dict(_DEFAULT_RATES)
    raw = os.getenv("MODEL_PRICING_JSON", "").strip()
    if raw:
        try:
            override = json.loads(raw)
            if isinstance(override, dict):
                for k, v in override.items():
                    if isinstance(v, list) and len(v) == 2:
                        rates[str(k)] = (float(v[0]), float(v[1]))
        except Exception:
            # Bad config is non-fatal — we just fall back to defaults.
            pass
    return rates


def lookup_rate(model: str) -> tuple[float, float]:
    """Return (input_per_1M, output_per_1M) for the given model.

    Tries the full name first, then the suffix after ':' (so "openai:gpt-5.4" and
    "gpt-5.4" both work).
    """
    if not model:
        return (0.0, 0.0)
    table = _rates()
    if model in table:
        return table[model]
    if ":" in model:
        suffix = model.split(":", 1)[1]
        if suffix in table:
            return table[suffix]
    return (0.0, 0.0)


def compute_cost(model: str, prompt_tokens: int | None, completion_tokens: int | None) -> float | None:
    """Return cost in USD or None if both token counts are missing."""
    if not prompt_tokens and not completion_tokens:
        return None
    rate_in, rate_out = lookup_rate(model)
    p = float(prompt_tokens or 0)
    c = float(completion_tokens or 0)
    return round((p * rate_in + c * rate_out) / 1_000_000.0, 6)


def estimate_tokens_from_text(text: str) -> int:
    """Cheap pre-tokenization heuristic for back-fill estimation only.

    Uses ~4 chars/token, matching OpenAI's rough rule of thumb. Never used for live billing —
    only to surface a rough $ figure on legacy rows that don't have real usage_metadata.
    """
    if not text:
        return 0
    return max(1, int(len(text) / 4))


def estimate_cost_from_messages(model: str, user_message: str, assistant_message: str) -> float:
    """Best-effort cost estimate when no real token counts are available."""
    p = estimate_tokens_from_text(user_message or "")
    c = estimate_tokens_from_text(assistant_message or "")
    rate_in, rate_out = lookup_rate(model)
    return round((p * rate_in + c * rate_out) / 1_000_000.0, 6)
