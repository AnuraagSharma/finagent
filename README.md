# finagent

Financial Deep Agent backend scaffold (FastAPI + Docker) with LangChain Deep Agents planned.

## What’s included
- **FastAPI backend** with a simple health endpoint
- **Docker-first** dev + deployment setup
- **Python deps** via `backend/requirements.txt`
- **Safe env template** via `.env.example` (real `.env` is gitignored)

## Prerequisites
- Docker Desktop (recommended)
- (Optional) Python 3.12+ if you want to run without Docker

## Quickstart (Docker)
1. Copy env template and fill keys:

```bash
cp .env.example .env
```

2. Build and run:

```bash
docker compose up -d --build
```

3. Test:
- `GET http://localhost:8000/health` → `{"status":"ok"}`

Stop:

```bash
docker compose down
```

## Local run (optional venv)
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:PYTHONPATH = (Resolve-Path .\\src).Path
uvicorn finagent.api.main:app --reload
```

## Notes on secrets / hosting
- Keep `.env` **out of git** (already ignored).
- In production, set environment variables in your hosting platform instead of shipping `.env`.

## Architecture notes (roadmap)

- **Sandboxed Python + internal data strategy** (phased, not all built yet): see [`docs/sandbox-internal-data-roadmap.md`](docs/sandbox-internal-data-roadmap.md).

## Next milestone
- Add a `POST /v1/agent/run` endpoint that uses `deepagents.create_deep_agent(model="openai:gpt-5.4", tools=financial_tools, ...)`.
