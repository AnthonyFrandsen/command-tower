# Command Tower

A mobile-friendly web interface for driving a [Claude Code](https://claude.ai/code) agent from any device on your local network. Think of it as a remote control for Claude Code — point your phone's browser at your desktop and issue prompts, watch the agent work in real time, and browse the resulting files, all without touching the keyboard.

## Why

Claude Code's official interfaces require you to be at the machine running the agent. Command Tower removes that constraint by exposing a lightweight web app over your LAN. It's useful when you want to kick off a coding task from the couch, check on a long-running run from another room, or share a development session with someone nearby.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite (TypeScript) |
| Backend | Node.js + Express (TypeScript) |
| Database | MongoDB |
| Reverse proxy | nginx |
| Containerization | Docker Compose |

## Setup

### Prerequisites

- Docker Desktop (recommended) — or Node.js 20+, MongoDB, and the `claude` CLI installed locally
- A Claude Code OAuth token **or** an Anthropic API key
- The project you want the agent to work on, accessible on the host machine

### Quick start (Docker Compose)

1. Copy the example env file and fill in the two required values:

   ```bash
   cp .env.example .env
   ```

   ```dotenv
   # Pick one auth method:
   CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...   # recommended — generate with `claude setup-token`
   # ANTHROPIC_API_KEY=sk-ant-...             # alternative

   WORKSPACE_PATH=/absolute/path/to/your/project
   ```

   > **Windows:** Docker Desktop handles Windows-style paths automatically, e.g. `C:/Users/you/projects/my-app`.

2. Start everything:

   ```bash
   docker compose up --build
   ```

3. Open **http://localhost:8082** in your browser — or use your desktop's LAN IP (e.g. `http://192.168.1.x:8082`) from your phone.

### Local dev (without Docker)

1. Start MongoDB: `docker run -p 27017:27017 mongo:7`
2. In `packages/backend/`: set your auth env var, then `npm run dev`
3. In `packages/frontend/`: `npm run dev`
4. Open http://localhost:5173

## Features

### Prompt runner
Submit a natural-language prompt and have the Claude Code agent execute it against your workspace. Output streams back to the browser in real time so you can follow along as the agent reads files, runs commands, and makes changes.

### Run history
Every run is persisted. Browse past runs, review their full output, and re-read results long after the agent has finished.

### File browser
Explore the workspace directory tree and read individual files directly in the browser — useful for quickly checking what the agent produced without switching back to your desktop editor.

## Auth

Set **exactly one** of the following:

- `CLAUDE_CODE_OAUTH_TOKEN` — a long-lived token generated once with `claude setup-token` on your desktop (valid 1 year, recommended)
- `ANTHROPIC_API_KEY` — a standard Anthropic API key
