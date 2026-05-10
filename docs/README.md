# FinAgent documentation

| Doc | Purpose |
|-----|---------|
| [Getting started](./getting-started.md) | Env vars, Docker vs local backend, frontend, auth header, Redis notes |
| [Deployment & Docker](./deployment.md) | Docker compose scope, env checklist, `NEXT_PUBLIC_BACKEND_URL`, CORS, pre-launch checklist |
| [Architecture](./architecture/README.md) | Frontend/backend/agent/storage overview + flowcharts |
| [Runbooks](./runbooks/README.md) | How to run, verify health, and troubleshoot |
| [Sandbox & internal data roadmap](./sandbox-internal-data-roadmap.md) | **Plan:** uploads (+), workspace, pandas/numpy/plotly, sandbox tiers, SQL/data pool future, **§9 prod posture & scaling** |
| [Analytics Python execution plan](./analytics-python-execution-plan.md) | **Plan:** giving the `analytics` subagent real Python execution (pandas / plotly) over data fetched by `data_pull` — tool surface, sandbox tier, prompts, frontend rendering, milestones |

The main project overview and API summary live in the [repository README](../README.md).
