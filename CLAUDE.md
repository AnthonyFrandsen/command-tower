# Command Tower

Mobile-friendly web app for issuing prompts to a Claude Code agent and monitoring results over the local network.

## Architecture

```
nginx (port 8082) ← phone browser
  ├── /api/*  →  backend:3001 (Express + Mongoose)
  └── /*      →  React SPA (static files)
backend → spawns `claude` CLI subprocess (non-interactive)
backend → MongoDB (persists run history + output)
```

## Monorepo layout

```
packages/
  backend/   Express API, Mongoose models, agent service
  frontend/  React SPA built with Vite
nginx/       nginx reverse-proxy config (SSE-aware)
```

## Commands

| Command | Description |
|---------|-------------|
| `npm test` | Type-check + coverage (backend) / tsc + biome (frontend) |
| `npm run build` | Build both packages |
| `npm run lint` | Biome lint both packages |
| `npm run lint:fix` | Biome auto-fix both packages |

Run in `packages/backend/` or `packages/frontend/` for a single package.

## Running locally (dev)

1. Start MongoDB: `docker run -p 27017:27017 mongo:7`
2. Backend: `cd packages/backend && ANTHROPIC_API_KEY=sk-... npm run dev`
3. Frontend: `cd packages/frontend && npm run dev` (proxies `/api` to localhost:3001)
4. Open http://localhost:5173

## Running via Docker Compose

1. Copy `.env.example` → `.env` and set exactly one auth method plus your workspace:

   **OAuth token (recommended):**
   ```
   CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
   WORKSPACE_PATH=/absolute/path/to/your/project
   ```
   Generate the token once with `claude setup-token` on your desktop. Valid for 1 year.

   **API key:**
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   WORKSPACE_PATH=/absolute/path/to/your/project
   ```

2. `docker compose up --build`
3. Open http://localhost:8082 (or your desktop's LAN IP from your phone)

**Windows note:** Docker Desktop handles Windows paths automatically (e.g. `C:/Users/you/projects/my-app`).

## Key environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | (optional) | OAuth token from `claude setup-token` — recommended auth method |
| `ANTHROPIC_API_KEY` | (optional) | Anthropic API key — alternative auth method |
| `WORKSPACE_PATH` | (required in Docker) | Host directory mounted as `/workspace` |
| `WORKSPACE_ROOT` | `process.cwd()` | Path inside the container the agent runs from |
| `MONGODB_URI` | `mongodb://localhost:27017/command-tower` | MongoDB connection string |
| `PORT` | `3001` | Backend port |

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/files?path=` | List directory or read text file |
| POST | `/api/runs` | Fire a prompt; returns `{runId}` (202) |
| GET | `/api/runs` | List all runs newest-first |
| GET | `/api/runs/:id` | Full run detail with output |
| GET | `/api/runs/:id/stream` | SSE stream — live agent output |
| DELETE | `/api/runs/:id` | Delete run record |

## Test coverage

Backend target: 80% lines/branches/functions/statements (enforced by c8).
Run `npm test` in `packages/backend` to see the full coverage report.
