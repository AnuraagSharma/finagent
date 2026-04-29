# Sandbox execution and internal data — roadmap

Related: [Getting started](getting-started.md) · [Repository README](../README.md)

This document captures architecture we are considering (not necessarily implemented yet): **sandboxed Python for analytics**, and **internal database–backed data** feeding the same analytics path. It is the single place to align on phased delivery and boundaries.

---

## Goals

1. **Raise analytics capability** beyond text and markdown tables: reproducible transformations, statistics, and optional charts backed by executed code—with **strict safety boundaries**.
2. **Keep today’s workflow** (external market/filings data via tools) while making room for **tomorrow’s workflow**: curated **internal** metrics and facts from Postgres (or another store) used the same way.
3. **Avoid painting ourselves into a corner**: data source can change from Yahoo/SEC/APIs → internal tables without redesigning the agent graph.

---

## Current state (baseline)

- The **supervisor** and **`data_pull`** subagent expose **financial tools** (e.g. Yahoo Finance, Alpha Vantage, SEC).
- The **`analytics`** subagent today is intentionally **reasoning-heavy** over facts returned by delegation; its tool list may be minimal or empty while we focus on prompts and UX.
- The **frontend** can render tables and lightweight charts when the model outputs structured markdown—these are **not** server-side Python plots unless we add execution below.

This roadmap does not replace that stack; it **adds** an execution layer when we are ready.

---

## Capability: sandboxed Python

**Intent:** Allow the analytics side of the product to **run constrained Python** (e.g. NumPy/pandas/matplotlib or similar) on **data supplied by the backend**, not on arbitrary filesystem or network access from user-written code.

**Why sandbox at all:** LLM-generated code is untrusted. Running it directly in the API process (`exec`) is unacceptable for multi-tenant or production use without isolation.

### Graduated isolation options (pick by phase)

| Tier | Idea | Strengths | Trade-offs |
|------|------|-----------|------------|
| **A — Lightweight worker** | Short-lived subprocess: timeout, memory cap where OS allows, disabled network, allowlisted imports, `MPLBACKEND=Agg` for headless charts. Data injected via variables / temp files in a confined directory. | Fast to ship; no new infra beyond the API container. | Weaker isolation (same kernel as the app host). Suitable for demos and controlled environments. |
| **B — One container per run** | FastAPI submits work to **`docker run --rm`** (or k8s Job): CPU/memory limits, no network, capture stdout and artifact files (e.g. PNG). | Much smaller blast radius than raw subprocess on the API pod. | More ops (Docker socket or orchestrator), latency per request. |
| **C — Managed sandbox** | Vendors optimized for AI code execution (e.g. E2B, Daytona, similar): microVM/container APIs, lifecycle managed for you. | Strong isolation + speed of integration; fewer homegrown sharp edges. | Cost, dependency on vendor, egress policies. |

**Claim:** Start with clarity on **timeouts**, **memory**, **no outbound network inside the sandbox**, and **explicit data inputs**. Upgrade **A → B → C** when trust/scale requirements demand it.

### Output shape to the conversation

- **Structured JSON / CSV / markdown tables** → existing UI parsers and Recharts-friendly paths continue to work.
- **Optional:** base64-encoded **PNG** (matplotlib `Agg`) for “real” plots when needed; frontend would render `<img>` or a dedicated viewer when we wire it.

---

## Capability: internal data pool (Postgres / warehouse)

**Intent:** Eventually **authoritative internal metrics** (forecasts, actuals, risk, allocations, CRM-linked facts—whatever your schema becomes) live in Postgres (or downstream warehouse). The agent must not get raw SQL scribbling rights.

### Recommended boundaries

1. **Read-mostly tooling:** parameterized queries or fixed **views**/APIs exposed as tools (e.g. `query_internal_analytics(...)`) returning **rows JSON**, not concatenated SQL from the model.
2. **Pass-through to sandbox:** query results become `DATA` (list of dicts, small dataframe serializable blob) injected into **`run_analytics_python`**—same sandbox whether data came from external tools or internal DB.
3. **Pooling / caching:** longer-term aggregates can be materialized in Postgres or refreshed by batch jobs; the agent consumes **consistent snapshots** suitable for CFO-style narratives.

---

## How this maps to Deep Agents

- **`data_pull`** (or equivalent): **retrieve** structured facts—from external APIs now, internal DB reads later (possibly split into multiple tools once complexity grows).
- **`analytics`:** **explain, compute, present** — once sandbox exists, **`run_analytics_python`** (name TBD) lives here so narratives and numbers stay aligned.
- **Supervisor:** still plans, delegates, and merges; does not need to know whether data was “external” or “internal,” only that subagents return structured facts.

---

## Phased rollout (suggested)

1. **Now:** Financial tools + strong markdown/table/chart UX; optional stub tool that returns “execution disabled” if we want to fix API contracts early.
2. **Next:** Implement **Tier A or B** sandbox + one analytics tool; wire optional PNG + JSON series.
3. **Then:** Read-only **internal data** tool(s) + schema contracts; feed results into the same sandbox.
4. **Scale/harden:** Move to **Tier C** or hardened **Tier B** if isolation or compliance requires it.

---

## Open decisions (to resolve when implementing)

- Exact **allowlist** of Python packages in the sandbox.
- Whether **Plotly** server-side is required or **matplotlib Agg + JSON** is enough for v1.
- **PII / classification** rules for internal rows (redaction, row caps, column allowlists).
- Per-tenant **quotas** (executions per minute, max rows injected).

---

## Related files in this repo

- Deep agent assembly: `backend/src/finagent/agent/deepagent/agent.py`
- Financial tools: `backend/src/finagent/agent/tools/financial.py`
- Prompts: `backend/src/finagent/agent/prompt/planner.md`, `analytics.md`, `data_pull.md`

When implementation lands, update this document with **actual tool names**, **env vars**, and **endpoint** behavior so it stays the source of truth.
