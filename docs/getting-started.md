# Getting started

This guide complements the root [`README.md`](../README.md) with setup detail and common pitfalls.

## 1. Clone and environment file

From the repository root:

```bash
cp .env.example .env
```

Edit `.env` so these are set correctly before starting the backend:

- **`DATABASE_URL`** — PostgreSQL (SQLAlchemy). Example for Neon:

  `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`

- **`OPENAI_API_KEY`**

- **`REDIS_URL`** — If you use `docker compose` as-is, you can rely on Compose’s default `REDIS_URL=redis://redis:6379/0` pointing at the bundled Redis Stack service. For a redis-cli string pasted from a host, see [Redis URL cleanup](#redis-url-cleanup).

Optional: **`OPENAI_MODEL`** (default `openai:gpt-5.4`), **`ALPHA_VANTAGE_API_KEY`**, **`SEC_USER_AGENT`** (e.g. `YourApp contact@example.com`).

## 2. Run the backend (Docker)

```bash
docker compose up -d --build
```

- API: `http://localhost:8000`  
- Interactive docs: `http://localhost:8000/docs`  
- Health: `GET /health`

Hot reload: `backend/src` is mounted into the container; Python changes reload when using the image default command (`uvicorn` without `--reload` may require a container restart depending on how you adjusted the Dockerfile—check locally).

## 3. Run the frontend

```bash
cd frontend-next
npm install
cp .env.local.example .env.local
```

Set `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` (or your deployed API).

```bash
npm run dev
```

App: `http://localhost:3000`.

### Demo authentication

Agent routes expect **`X-User-Id`**. The UI stores this in Settings (Zustand + persistence). If you see **401 Missing X-User-Id**, open **Settings** and set a non-empty user id, or send the header from curl:

```bash
curl -sN -X POST http://localhost:8000/v1/agent/stream \
  -H "Content-Type: application/json" \
  -H "X-User-Id: demo-user" \
  -d "{\"message\":\"Hello\"}"
```

## 4. Run the backend (local Python, no Docker)

Use a dedicated virtual environment.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # Windows
pip install -r requirements.txt

$env:PYTHONPATH = (Resolve-Path .\src).Path
$env:DATABASE_URL = "<postgres-url>"
$env:REDIS_URL = "redis://127.0.0.1:6379/0"
$env:OPENAI_API_KEY = "<key>"

uvicorn finagent.api.main:app --reload --host 0.0.0.0 --port 8000
```

Start Redis locally (e.g. Redis Stack via Docker on port 6379) so checkpoints work.

### `deepagents` version

This project targets **`deepagents>=0.5`** (see `requirements.txt`). An older installed version (for example `0.0.x`) lacks modules such as `deepagents.backends` and will fail on import.

## Redis URL cleanup

Backend settings optionally normalize pasted values (`backend/src/finagent/infra/config/settings.py`):

- Strips stray quotes  
- Extracts `-u redis://…` from a full `redis-cli …` helper line  
- Rewrites Upstash TCP hosts from `redis://` to **`rediss://`** when the hostname suggests TLS

Prefer a URL that matches your provider’s TLS expectations.

### `maxmemory` / OOM on cloud Redis

Free-tier Redis can evict keys or refuse commands when memory is full—LangGraph checkpoints and agent state consume space. Use **local Redis Stack** during development (`docker-compose` service) or a **right-sized** cloud plan for demos/production.

## CORS

The API allows localhost origins used by this repo (including various ports via regex). If you deploy a frontend on another origin, extend `CORSMiddleware` in `backend/src/finagent/api/main.py`.

## Further reading

- [Sandbox Python + internal data roadmap](./sandbox-internal-data-roadmap.md)
