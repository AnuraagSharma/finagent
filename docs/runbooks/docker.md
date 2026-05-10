# Docker runbook

## What Compose includes

`docker-compose.yml` currently runs:

- `redis` (Redis Stack) on `6379`
- `backend` (FastAPI) on `8000`

Postgres and the Next.js frontend are **not** in Compose by default.

That means the backend still needs:

- a reachable **Postgres** (via `DATABASE_URL`), and
- an **OpenAI key** (`OPENAI_API_KEY`)

## Start / restart

```bash
docker compose up -d --build
docker compose restart backend
```

Check status:

```bash
docker compose ps
docker compose logs backend --tail 80
```

## Rebuild when new Python files were added

If you added new backend modules and the container doesn’t pick them up (common when the image is stale), rebuild:

```bash
docker compose up -d --build backend
```

## Environment variables

Compose reads `./.env` (repo root) for backend env. Required:

- `DATABASE_URL`
- `OPENAI_API_KEY`

Optional:

- `REDIS_URL` (defaults to `redis://redis:6379/0` inside Compose)
- `OPENAI_MODEL`
- `ADMIN_USER_IDS` (CSV allow-list; empty = open for demo)

