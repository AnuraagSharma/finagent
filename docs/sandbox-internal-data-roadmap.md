# Data sandbox & analytics — product & engineering plan

Related: [Getting started](./getting-started.md) · [Repository README](../README.md)

This is the **authoritative plan** for: **uploaded tabular data + per-chat workspace + pandas/numpy/plotly-style analytics**, and how it connects to today’s agent and to **future SQL/internal data**. Code here may lag this doc until each phase lands; update sections when implementations ship.

---

## 1. What we’re building (product)

| Capability | Notes |
|------------|------|
| **Attach data** | User uploads **CSV / Excel** from the composer **`+`** (same slot as future attachments). |
| **Thread workspace** | Each conversation (`thread_id`) gets a **dedicated folder** on the server: uploads and derived files live **only under that prefix** (“sandbox-ish” tenancy, not a shared pool). |
| **Analyze on demand** | After upload, prompts like “clean this”, “summarize”, “plot X vs Y” drive **cleanup, stats, charts** — not hand-wavy text only. |
| **Libraries (v1 scope)** | **pandas**, **numpy**, **plotly** (primary for charts); **matplotlib** optional if we need static PNG. Math/stats: means, std dev, correlations, etc. |
| **Later: SQL / data pool** | **Generated or templated SQL** against **curated** internal or warehouse views — **not** raw open-ended SQL from the model; separate phase with RBAC. |

---

## 2. Current state in this repo (baseline)

- **Agent:** Deep Agents graph in `backend/src/finagent/agent/deepagent/agent.py` — **`StateBackend`** (agent artefacts in checkpoints/state), **financial tools** on the supervisor/`data_pull` path (`backend/src/finagent/agent/tools/financial.py`).
- **Analytics subagent:** Prompt in `backend/src/finagent/agent/prompt/analytics.md` — strong **presentation** rules; **`tools: []`** today → no Python over user files yet.
- **Frontend:** Composer **`+`** is present but disabled; chat can render **tables/charts from markdown**, not plots produced by server-side Python unless we add execution + asset URLs.

Baseline does **not** yet provide: multipart upload API, durable per-thread filesystem, or sandboxed **`execute`**.

---

## 3. How LangChain Deep Agents expects this to work (review)

Upstream guidance (see **[Sandboxes](https://docs.langchain.com/oss/python/deepagents/sandboxes)** and **[Backends](https://docs.langchain.com/oss/python/deepagents/backends)**):

- **Sandboxes** = isolated environments with **filesystem tools** (`read_file`, `write_file`, …) plus **`execute`** for commands, bounded from the host.
- **Filesystem backends** can use a **`root_dir`** so the agent never escapes a session folder.
- **Modal / Runloop / …** providers = production-grade isolation versus **local/dev** backends.

So our “thread workspace + run Python over files” aligns with:

- Either **filesystem backend rooted at** `${DATA_ROOT}/{user}/{thread}/`, **plus** eventual **remote sandbox** for `execute`, **or**
- **Tier A/B** below if we defer vendor sandboxes briefly.

---

## 4. Isolation tiers (engineering — same as internal review, kept explicit)

Choose one path per phase; upgrade when scale/compliance demands it.

| Tier | Mechanism | Use when |
|------|-----------|----------|
| **A — Guarded subprocess** | Short-lived Python subprocess: **cwd** locked to thread dir, **timeout**, memory cap where possible, **no network**, **allowlisted imports**, headless plotting. | Fast MVP; demo / low blast radius deployments. |
| **B — Container per job** | `docker run --rm` or k8s Job: resource limits, no network egress, collect stdout + artefacts (PNG/HTML). | Stronger isolation on your own infra. |
| **C — Managed sandbox** | Modal / Runloop / similar (matches Deep Agents examples). | Production multi-tenant, less DIY ops. |

**Non-negotiables:** timeouts, bounded file size/count, MIME allowlist, **no credential mount** inside sandbox unless explicitly designed.

---

## 5. Architecture sketch

```
Composer (+) ──► POST multipart upload ──► STORAGE: .../users/{user_id}/threads/{thread_id}/...
                                              │
Frontend send message ─► existing agent ──────┼──► tools read only under thread root
                                              │
                                     (optional Phase 3)
                                              └──► sandbox execute: python ...

Future: internal DB ──► read-only tool(s) ──► rows JSON ──► same analytics path + optional write to workspace
```

- **Naming:** Persist uploads with safe server-side names (UUID prefix); expose **logical names** to the model from a manifest if needed.

---

## 6. Phased rollout (recommended order)

### Phase P0 — Contracts & UX (minimal code)

- **API sketch:** `POST /v1/threads/{thread_id}/upload` (or `POST /v1/agent/uploads` + `thread_id` body) returning `{ file_id, path, mime, rows_preview? }`.
- **Enable `+`** in `Composer.tsx`: wire to upload; show list of attachments for that thread (lightweight banner or chip row).
- **Agent context:** Inject into runtime context/prompt: **“Attached files this turn: …”** and **workspace root URI** — so the supervisor routes file work to **`analytics`** (or dedicated subagent later).

### Phase P1 — **Parameterized tools only** (no arbitrary `exec`)

Keeps blast radius smallest while validating flows.

Examples (names illustrative):

| Tool | Behavior |
|------|-----------|
| `list_workspace_files` | List `{thread}` directory. |
| `load_table_preview` | pandas read_* with row/col caps; returns schema + sample. |
| `describe_column_stats` | mean / std / nulls — fixed operations. |
| `build_plotly_figure_spec` | Input: column refs + chart type → **JSON** for frontend or Markdown embed. |

**Outcome:** Cleanup + stats + plotly-aligned output **without** LLM-authored arbitrary scripts.

### Phase P2 — **Sandbox execution** (pandas/numpy/plotly scripts)

- Add **`execute_python`** **or** mount **Sandbox backend** per Deep Agents (Modal/Runloop/B/docker) reading/writing **only** under thread root.
- Pin **requirements** image or venv (`pandas`, `numpy`, `plotly`, optional `matplotlib`, `openpyxl`/`pyarrow`).
- Artefacts: **Plotly JSON**, **PNG**, cleaned **CSV**, all written under workspace and surfaced via signed URLs.

### Phase P3 — **Internal / warehouse SQL**

- Tool such as **`query_internal_snapshot(...)`** — parameterized or template-based; returns **tabular JSON**.
- Optionally materialize snapshots into Postgres; agent consumes **facts** identically whether from uploads or warehouse.

---

## 7. Open decisions before coding

| Decision | Options / notes |
|----------|-----------------|
| **Where `thread_id` exists before upload** | Create thread eagerly on “new chat”, or mint UUID client-side reserved for uploads. |
| **Backend vs orchestration** | API server writes files vs job queue — start synchronous; move async when files get large. |
| **Charts in UI** | Plotly JSON in message vs static asset URL — Prefer JSON + existing chart components when possible. |
| **Retention** | Delete workspace files N days after last activity / account policy. |

---

## 8. Related files & maintenance

**Update this doc** when shipping: tool names, env vars (`DATA_ROOT`, sandbox provider keys), and upload endpoints.

| Area | Paths |
|------|-------|
| Agent graph | `backend/src/finagent/agent/deepagent/agent.py` |
| Tools | `backend/src/finagent/agent/tools/` |
| Prompts | `backend/src/finagent/agent/prompt/` |
| API | `backend/src/finagent/api/` |
| Frontend composer | `frontend-next/src/components/Composer.tsx`, `frontend-next/src/lib/api.ts` |

---

## 9. Production posture & recommended go‑ahead (demo ~20 → scale later)

### What “the bot must have” in prod

The product expectation is correct: **in production**, FinAgent needs the **capability** to analyze **tabular data with real Python**, not pretend analysis. That capability should be implemented as **first‑class infra**, even if the **first release** exposes only upload + bounded tools—or the same stack runs full sandbox sooner.

Patchwork anti‑patterns to **avoid for anything you’ll deploy** (even to 20 testers):

| Avoid | Why |
|-------|-----|
| `exec()` / unbounded subprocess **in the same process** as the FastAPI SSE handler | Takes down chat for everyone under load / memory spikes; mixes trust boundaries. |
| “We’ll refactor later” for **filesystem layout** (`user` / `thread` prefix, signed URLs). | Migrating blobs and paths hurts once users have threads. |

### What FastAPI is for vs what execution is for

Yesterday’s gist still holds—but with this boundary:

| Layer | Responsibility |
|-------|----------------|
| **FastAPI (ingress)** | Auth, quotas, multipart **upload**, persist metadata + **stored object path**, run **LangGraph** stream, enqueue **heavy work**, serve **downloads** via signed URLs. |
| **Execution (workers / sandbox)** | **pandas/numpy/plotly** (`execute` or parameterized tools internally calling the same libs). Bounded **CPU/memory/time**, **no outbound network** from the analysis environment unless explicitly allowlisted later. |

So: FastAPI “gets the request” and **owns** correctness of **who owns which file**, not necessarily “runs all Python inline in every request forever.”  

For **conversation turns that only need previews/stats**, the API can invoke **short tool code** synchronously until latency limits push you toward a queue.

### Go‑ahead approach (deployable demo, scalable shape)

Treat **production shape** first, ship **narrow features** inside it:

1. **Storage**: Per‑user / per‑`thread_id` prefixes from day one (`DATA_ROOT` or S3‑compatible bucket). Avoid ad‑hoc temp dirs without thread binding.
2. **Execution boundary**: Prefer **either** constrained **Docker job per analytics run**, **or** a **managed sandbox** (Modal / Runloop / similar per Deep Agents docs), **from the first externally visible “run analysis” milestone**—even for 20 users. That avoids a rewrite when you onboard customer two.
3. **Queue optional at 20**: A **background worker** thread inside one API deployment can be enough initially if you cap concurrency (e.g. at most **N** simultaneous analysis jobs globally). Move to Redis + Celery/RQ/workers **when** tails or parallelism demand it—you keep the **same** “job → sandbox → artefacts” boundary.
4. **Horizontal scale**: Stateless **multiple FastAPI replicas** behind load balancer → **shared Redis** (you already checkpoint there) → **shared storage** for uploads. **Vertical**: bigger worker memory for pandas-heavy runs.

That gives you **“good to go tomorrow” for ~20 demo users**, with knobs to **scale vertically** (fat workers) **or horizontally** (more replicas + queues) without ripping out assumptions.

### Conclusion

- **Goal:** Capability = **workspace + bounded/real Python analysis** path that matches prod expectations.  
- **Means:** Strict split **API orchestration ≠ analysis execution**, storage namespaced early, sandbox or container boundary from the first shipped analysis feature.  
- **Not patchwork:** One execution model you can tighten (limits, egress, quotas) rather than swapping `exec()` in‑process later.

---

## 10. References (external)

- [Deep Agents — Sandboxes](https://docs.langchain.com/oss/python/deepagents/sandboxes)
- [Deep Agents — Backends](https://docs.langchain.com/oss/python/deepagents/backends)
