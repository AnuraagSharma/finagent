# Troubleshooting

## 401: Missing `X-User-Id`

Cause: demo auth requires the header.

Fix:

- UI: Settings → set User id
- curl: add `-H "X-User-Id: demo-user"`

## 404 on `/v1/analytics/*`

Cause: backend not restarted after pulling latest code (or container image stale).

Fix (Docker):

```bash
docker compose restart backend
docker compose up -d --build backend
```

Verify:

```bash
curl -H "X-User-Id: demo-user" http://localhost:8000/v1/analytics/summary
```

## CORS error in browser

Cause: frontend origin not allowed by backend CORS.

Fix:

- Update `CORS_ALLOW_ORIGINS` env (comma-separated) and restart backend, or
- Add your origin to `backend/src/finagent/api/main.py` CORS config.

## Agent doesn’t resume old threads

Cause: Redis not reachable or `REDIS_URL` incorrect.

Fix:

- Confirm Redis container is running: `docker compose ps`
- Confirm backend sees correct `REDIS_URL`
- For managed Redis, ensure TLS (`rediss://`) if required

## Tokens/cost missing in analytics

Older rows may have no token usage metadata (they were logged before token capture existed).

Fix:

- Run a few new chats to generate rows with `prompt_tokens/completion_tokens`.
- Costing falls back to estimates for older rows; this is expected.

