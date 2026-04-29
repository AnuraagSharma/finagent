# FinAgent

**FinAgent** is a financial research assistant built with **LangChain Deep Agents** (supervisor planner, `data_pull` and `analytics` subagents), **FastAPI**, **Redis** (LangGraph checkpoints + agent state), **PostgreSQL** (telemetry / history tables), and a **Next.js** UI with streaming chat, task progress, and rich markdown charts.

## What’s in this repo

| Area | Stack |
|------|--------|
| Agent | `deepagents`, LangGraph, OpenAI (`openai:gpt-5.4` by default), subagents + skills + prompt MDs |
| API | FastAPI, `POST /v1/agent/stream` (SSE), thread history, demo `X-User-Id` auth |
| Memory / state | Redis (`RedisSaver` checkpoints); `StateBackend` for agent filesystem state |
| Data | Yahoo Finance / Alpha Vantage / SEC tools; Postgres for request logging |
| UI | Next.js 16, React 19, Tailwind v4, Recharts table/bar charts, theme toggle |

```
Fin_Agent/
├── backend/           # Python package: finagent.*
├── frontend-next/     # Next.js app (primary UI)
├── docs/              # Extra docs (setup, roadmap)
├── docker-compose.yml # redis + backend
└── .env               # secrets — not committed (use .env.example)
```

## Prerequisites

- **Docker Desktop** (recommended for Redis + backend), or run Redis/Postgres yourself  
- **Node.js 20+** and npm (for `frontend-next`)  
- **Python 3.12+** if you run the backend outside Docker  
- **OpenAI API key**  
- **PostgreSQL URL** (e.g. Neon) for `DATABASE_URL`

## Environment variables

Copy `.env.example` to `.env` at the **repo root** (used by Docker Compose for the backend).

| Variable | Required | Purpose |
|----------|-----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (SQLAlchemy) |
| `OPENAI_API_KEY` | Yes | LLM calls |
| `REDIS_URL` | Optional in Compose | Defaults to `redis://redis:6379/0` inside Docker |
| `OPENAI_MODEL` | No | Default `openai:gpt-5.4` |
| `ALPHA_VANTAGE_API_KEY` | No | Fundamentals tool |
| `SEC_USER_AGENT` | No | SEC Edgar User-Agent (required shape for `data.sec.gov`) |

Frontend (`frontend-next/`): copy `frontend-next/.env.local.example` → `.env.local` → `NEXT_PUBLIC_BACKEND_URL` (e.g. `http://localhost:8000`).

Detailed notes: **[`docs/getting-started.md`](docs/getting-started.md)**.

## Quickstart (Docker backend + local UI)

1. **Env**

   ```bash
   cp .env.example .env
   # Edit .env: DATABASE_URL, OPENAI_API_KEY, REDIS_URL if not using bundled Redis
   ```

2. **Redis + API**

   ```bash
   docker compose up -d --build
   ```

   - Health: [`http://localhost:8000/health`](http://localhost:8000/health)  
   - API docs: [`http://localhost:8000/docs`](http://localhost:8000/docs)

3. **Frontend**

   ```bash
   cd frontend-next
   npm install
   cp .env.local.example .env.local
   npm run dev
   ```

   Open [`http://localhost:3000`](http://localhost:3000).  
   The UI sends **`X-User-Id`** (demo auth) — set a value in **Settings** if requests return 401.

Stop containers: `docker compose down`.

## Quickstart (backend without Docker)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt

$env:PYTHONPATH = (Resolve-Path .\src).Path
$env:DATABASE_URL = "<your-postgres-url>"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:OPENAI_API_KEY = "<key>"
uvicorn finagent.api.main:app --reload --host 0.0.0.0 --port 8000
```

Use a local **Redis Stack** (or compatible Redis) for checkpoints; `deepagents` **≥ 0.5** is required — see `backend/requirements.txt`.

## HTTP API (overview)

All agent routes use prefix **`/v1/agent`**. For non-browser clients, send header **`X-User-Id`** (string, demo tenancy).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `POST` | `/v1/agent/run` | Single agent run (JSON response) |
| `POST` | `/v1/agent/stream` | **SSE** stream: tokens + `step` / `todos` events |
| `GET` | `/v1/agent/thread/{thread_id}` | Thread message history (checkpoint-backed) |

OpenAPI: `/docs` when the server is running.

## Architecture notes

- **Roadmap (sandbox Python + internal DB)**: [`docs/sandbox-internal-data-roadmap.md`](docs/sandbox-internal-data-roadmap.md)  
- **Deep agent assembly**: `backend/src/finagent/agent/deepagent/agent.py`  
- **Prompts**: `backend/src/finagent/agent/prompt/*.md`  
- **Skills**: `backend/src/finagent/agent/skills/*/SKILL.md`

## Production / secrets

- Never commit `.env`; inject secrets in your host or CI.  
- Size **Redis** for checkpoints (LangGraph + state); free-tier cloud Redis can hit `maxmemory` limits under load — prefer local Redis Stack for dev or sized cloud instances for demos.

## License

Specify as needed for your deployment.
