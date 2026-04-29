# Deployment & Docker notes

Companion: [Getting started](./getting-started.md) · [Sandbox roadmap](./sandbox-internal-data-roadmap.md)

Use this when you **host FinAgent for others** or run **everything in Docker**. It collects what must be true so the app is **actually usable** from a browser (not only on your laptop).

---

## What `docker-compose.yml` does today

| Service | Role |
|---------|------|
| **redis** | LangGraph checkpoints + related Redis usage (`REDIS_URL` defaults to `redis://redis:6379/0` on the Docker network). |
| **backend** | FastAPI on port **8000**, built from `backend/Dockerfile`. Expects **`.env`** at repo root (see `.env.example`). |

**Not included in compose:** **Postgres** and the **Next.js frontend**. You must supply a database URL and deploy the UI separately (or extend compose later).

---

## Required environment (backend)

| Variable | Notes |
|----------|--------|
| **`DATABASE_URL`** | **Required** — the API will not start without it (`get_settings()`). Point to any reachable Postgres (Neon, RDS, local `postgres` service, etc.). |
| **`OPENAI_API_KEY`** | Required for the model. |
| **`REDIS_URL`** | Optional in compose: defaults to `redis://redis:6379/0` when using the bundled Redis. Use your cloud URL if not using compose Redis. |

See **`.env.example`** for optional keys (Tavily, Alpha Vantage, LangSmith, etc.).

---

## Frontend + API URL

The UI reads **`NEXT_PUBLIC_BACKEND_URL`** (build-time) or the value stored in **Settings** (see `frontend-next/src/lib/stores.ts`).

- **Local dev:** `http://localhost:8000` works.
- **Hosted site:** You must set **`NEXT_PUBLIC_BACKEND_URL`** to your **public API base** (e.g. `https://api.yourdomain.com`) **when you build** the frontend, **or** users must set the backend URL in the in-app Settings.

If the browser still calls `localhost:8000` while the page is served from another host, **chat will fail** for everyone except you.

---

## CORS (why “it works here but not in prod”)

`backend/src/finagent/api/main.py` allows **localhost / 127.0.0.1** origins by default.

If the SPA runs on **`https://app.example.com`**, add that origin to **`allow_origins`** (or make origins configurable via env) before asking external users to use the product.

---

## Checklist before “real” users

- [ ] Postgres reachable; **`DATABASE_URL`** set in the environment that runs the backend.
- [ ] **`OPENAI_API_KEY`** set.
- [ ] **`REDIS_URL`** correct (compose Redis vs managed).
- [ ] Frontend built with correct **`NEXT_PUBLIC_BACKEND_URL`**, or users instructed to set backend URL in Settings.
- [ ] **CORS** includes your production frontend origin(s).
- [ ] HTTPS / reverse proxy configured if you terminate TLS in front of the API.

---

## Optional hardening (later)

- Remove dev bind-mount of `./backend/src` in production compose (use image-only deploy).
- Add a **Postgres** service to compose or document external DB only (current default).
- Containerize the **Next** app and document a single-stack compose if you want one command for full stack.

---

## Quick local Docker trial

1. Copy `.env.example` → `.env` and fill **`DATABASE_URL`**, **`OPENAI_API_KEY`**.
2. From repo root: `docker compose up --build`.
3. API: `http://localhost:8000` (health/docs per your OpenAPI).
4. Run the frontend separately (`cd frontend-next && npm run dev`) unless you add a frontend service.

When you change deployment details, update this file so it stays accurate.
