# Local development runbook

## Start (recommended)

### Backend (Docker)

From repo root:

```bash
docker compose up -d --build
```

Verify:

- `GET http://localhost:8000/health` → `{"status":"ok"}`
- `http://localhost:8000/docs` loads OpenAPI

Notes:

- Postgres is **not** included in Compose; you must provide a valid `DATABASE_URL` in `./.env`.

### Frontend

```bash
cd frontend-next
npm install
cp .env.local.example .env.local
```

Set `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` then:

```bash
npm run dev
```

Verify:

- `http://localhost:3000` loads chat
- `http://localhost:3000/analytics` loads dashboard

## Demo auth (required)

All API calls require header **`X-User-Id`**.

- In UI: Settings → User id
- From curl:

```bash
curl -sN -X POST http://localhost:8000/v1/agent/stream \
  -H "Content-Type: application/json" \
  -H "X-User-Id: demo-user" \
  -d "{\"message\":\"Hello\"}"
```

## Stop

```bash
docker compose down
```

