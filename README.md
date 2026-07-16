# Project Control Center

One portal for backend uptime, frontend status, and your agent staff. Full architecture, data
model, and build phases live in [project-control-center-plan.md](./project-control-center-plan.md)
— read that first.

This repo is currently **structure-only**: routes, API stubs, and package boundaries are
scaffolded, but no business logic (health pinging, wake-up polling, agent execution, voice) has
been implemented yet. That starts at Phase 1.

## Workspace layout

```
apps/
  web/            Next.js (App Router) portal — deployed to Vercel.
                  Composes packages/db + packages/ui + packages/types. Owns routes and API stubs.
  agent-bridge/   Scaffold only (Phase 4). The local daemon that will eventually poll
                  command_queue and drive Claude Code sessions on your machine.
packages/
  types/          Shared TS interfaces (Project, Agent, PingLog, Command) — zero runtime deps.
  db/             longcelot-sheet-db schemas + a typed adapter singleton. apps never call
                  createSheetAdapter directly — they import typed table helpers from here.
  ui/             Shared React primitives (Card, StatusDot, Button). Presentation only —
                  no data-fetching, no packages/db imports.
  config/         Shared tsconfig, ESLint flat config, and Tailwind preset.
```

Package manager: **pnpm** workspaces. Task orchestration: **Turborepo**. Node 20+.

## Commands

```bash
pnpm install     # from the repo root
pnpm dev         # starts apps/web (and apps/agent-bridge once Phase 4 lands)
pnpm build       # builds every buildable package/app
pnpm lint        # lints every package/app
pnpm type-check  # type-checks every package/app
```

## Environment

Two separate `.env.example` files, on purpose:

- `packages/db/.env.example` — Google OAuth credentials for the Sheets connection
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ADMIN_SHEET_ID`).
- `apps/web/.env.example` — Render/Vercel API tokens (`RENDER_API_KEY`, `VERCEL_API_TOKEN`).

Copy each to a sibling `.env` and fill in values before running anything that touches Sheets,
Render, or Vercel.

## Build phases

See plan §9. This scaffold covers the structure all five phases share; features land in that
order, starting with core monitoring (Phase 1).
