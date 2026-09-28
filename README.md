# Project Control Center

A single dashboard for the three things that fragment across tabs when you run several side
projects: is the backend actually up, did the last frontend deploy succeed, and which Claude Code
agent is working on what. Dark-first "Mission Control" UI, live data, no separate database server.

## What it does

- **Backend uptime** — pings every Render service on a schedule, auto-detects whether a project
  exposes a `/health` endpoint (falling back to a bare-URL ping), wakes sleeping free-tier
  services on demand, and keeps a response-time history per project.
- **Frontend deploy status** — pulls live deploy state from the Vercel API per project, plus an
  auto-scraped Open Graph thumbnail (no screenshot service, no API key) so each card shows what
  the site actually looks like.
- **Agent roster** — a roster of Claude Code agents, one per local project, each with its own
  briefing/context, ready to be driven from a voice or text console.
- **Full CRUD portal** — projects, agents, and app settings all live-edit against the same data
  store, gated behind email/password or Google OAuth login (single-user, allowlisted email).
- **Self-triggering health checks** — a GitHub Actions cron hits the health-check endpoint every
  10 minutes so free-tier backends don't fall asleep, without needing a paid cron tier anywhere.

**Current state:** the monitoring portal (uptime, deploy status, thumbnails, roster CRUD, auth,
cron) is fully built and running against a live Google Sheet — not a demo/stub. The one piece
still open is wiring the console to actually *drive* an agent (`agent-bridge`, a local daemon that
will poll for commands and shell out to Claude Code) — the UI for it exists, the execution path
doesn't yet.

## Tech stack

- **Frontend:** Next.js 16 (App Router) on React 19, TypeScript, Tailwind CSS v3, Radix UI
  primitives, TanStack Query for data fetching/polling, dnd-kit for drag-and-drop reordering.
- **Backend:** Next.js API routes (no separate server) — Vercel serverless functions calling the
  Render and Vercel REST APIs directly.
- **Data layer:** [`longcelot-sheet-db`](https://www.npmjs.com/package/longcelot-sheet-db) — a
  schema-first SDK (think a lightweight typed ORM) that reads and writes typed tables against a
  Google Sheet instead of a hosted database. Tables (`projects`, `agents`, `ping_logs`,
  `command_queue`, `settings`) are defined once via `defineTable` schemas and CRUD'd through a
  typed adapter (`table.create()/findMany()/update()/delete()`) — the rest of the app never talks
  to the Sheets API directly. It was a deliberate choice for a single-user internal tool: zero
  database hosting cost, the data is trivially inspectable/editable by hand in a spreadsheet when
  needed, and the typed schema layer means it behaves like a real DB from the app code's
  perspective.
- **Auth:** email/password (scrypt-hashed) and Google OAuth, both gated to one allowlisted email,
  enforced in Next.js middleware before any page renders.
- **Scheduling:** GitHub Actions cron (not Vercel Cron — the free tier there is daily-only, too
  infrequent to keep a Render free instance warm).
- **Monorepo tooling:** pnpm workspaces + Turborepo, shared ESLint/TypeScript/Tailwind config
  packages, a `packages/types` leaf package with zero runtime dependencies.

## Repo layout

```
apps/
  web/            Next.js portal — deployed to Vercel. Composes packages/db + packages/ui +
                  packages/types. Owns all routes, API endpoints, and app-specific chrome.
  agent-bridge/   Local daemon (in progress) that will poll for agent commands and drive
                  Claude Code sessions on your machine — the one piece Vercel structurally can't
                  run, since it needs access to your local filesystem.
packages/
  types/          Shared TS interfaces (Project, Agent, PingLog, Command, SettingRow) — zero
                  runtime dependencies.
  db/             longcelot-sheet-db schemas + a typed adapter singleton. Nothing outside this
                  package talks to the Sheets API directly.
  ui/             Shared React primitives (Card, StatusDot, Table, Dialog, Sparkline, etc.) —
                  presentation only, no data-fetching.
  config/         Shared tsconfig, ESLint flat config, and Tailwind preset.
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how the pieces actually connect (with diagrams) and
[project-control-center-plan.md](./project-control-center-plan.md) for the original design
rationale and phased build order.

## Commands

```bash
pnpm install     # from the repo root — installs the whole workspace
pnpm dev         # starts apps/web
pnpm build       # builds every buildable package/app
pnpm lint        # lints every package/app
pnpm type-check  # type-checks every package/app
```

## Environment

Two separate `.env.example` files, on purpose — Sheets credentials and Render/Vercel/auth
credentials are different concerns:

- `packages/db/.env.example` — Google OAuth credentials for the Sheets connection.
- `apps/web/.env.example` — Render/Vercel API tokens, portal auth vars, `CRON_SECRET`.

Copy each to a sibling `.env` and fill in values. Full step-by-step setup (Google Cloud project,
OAuth consent flow, Vercel env vars, GitHub Actions secrets) is in
[ARCHITECTURE.md §4](./ARCHITECTURE.md#4-environment-variable-setup-step-by-step).
