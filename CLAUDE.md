# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Project Control Center — a portal that monitors Render backend uptime, Vercel frontend deploy
status, and manages a roster of Claude Code agents assigned to local projects, with a voice
console to talk to them. Full architecture, data model, and phased build order live in
[project-control-center-plan.md](./project-control-center-plan.md) — read it before making
product decisions.

**Current state: phases 1–3 of plan.md §9 are built and wired to a live Google Sheet** —
Projects/Agents/Settings CRUD, Render health pinging + wake-up polling (with a `/health`-then-
bare-`url` fallback and auto-detected `has_health_endpoint` tracking), Vercel deploy status,
Open-Graph-scraped site thumbnails, the GitHub Actions health-check cron, the full Mission
Control design system, and email/password + Google OAuth auth are all real and working — not
stubs. The one deliberate exception: `POST /api/agents/:id/message` still 501s, since it depends
on the agent-bridge daemon (Phase 4, `apps/agent-bridge`), which remains an unimplemented
skeleton — don't assume voice/chat execution works. `Tasks/app-backend.md` and
`Tasks/app-frontend.md` are the authoritative up-to-date checklists of what's actually built;
`Tasks/agent-chat.md`'s Log has the detailed history and reasoning behind each decision.

### Multiple agents work this repo concurrently

Three separate task lists exist under `Tasks/` — `app-frontend.md`, `app-backend.md`, and
`agent-bridge.md` — meant to be worked by separate Claude Code sessions running at the same time.
**Check `Tasks/agent-chat.md` at the start of a session and before touching anything another
agent might own** (API response shapes, shared types, anything in `packages/*`). Post there
if your task depends on something another agent's session controls, instead of guessing.

## Commands

```bash
pnpm install                     # from repo root — installs the whole workspace
pnpm dev                         # turbo run dev — starts apps/web (agent-bridge has no dev server output yet, runs via tsx watch)
pnpm build                       # turbo run build — only apps/web has a real build step (next build)
pnpm lint                        # turbo run lint — eslint across every package/app
pnpm type-check                  # turbo run type-check — tsc --noEmit across every package/app
```

Run a task for a single package instead of the whole workspace:

```bash
pnpm --filter @pcc/web dev
pnpm --filter @pcc/db type-check
```

Sheet-DB schema commands (run from `packages/db`, or `pnpm --filter @pcc/db db:sync`):

```bash
pnpm --filter @pcc/db db:sync        # lsdb sync — creates/updates tabs in the admin Google Sheet
pnpm --filter @pcc/db db:erdiagram   # lsdb erdiagram — regenerates the schema ER diagram
```

No test suite exists yet — don't go looking for one.

## Architecture

pnpm workspaces + Turborepo monorepo, TypeScript everywhere, Node 20+.

```
apps/
  web/            Next.js 16 (App Router), Tailwind v3. Deployed to Vercel. The only app that
                  composes packages/db + packages/ui + packages/types together.
  agent-bridge/   Local daemon skeleton (Phase 4, not implemented). Will poll command_queue
                  and drive Claude Code sessions on the user's machine — see agent-bridge.md.
packages/
  types/          Shared TS interfaces: Project, Agent, PingLog, Command, SettingRow + their enum
                  unions. Zero runtime dependencies — this is the leaf of the dependency graph.
  db/             longcelot-sheet-db schemas (schemas/admin/*.ts) + a typed adapter singleton
                  (src/adapter.ts, src/tables.ts). Exports getAdapter()/getAdminContext() and
                  typed table helpers (projectsTable(), agentsTable(), pingLogsTable(),
                  commandQueueTable(), settingsTable()). Nothing outside this package calls
                  createSheetAdapter directly. New schema file added? It also has to be added to
                  buildAdapter()'s registerSchemas([...]) call in src/adapter.ts — a schema file
                  existing alone type-checks fine but throws `SchemaError` at runtime, since
                  registration is a separate step (see Tasks/agent-chat.md's 2026-07-16 20:48 log
                  entry for how this bit someone already).
  ui/             Shared React primitives (Card, StatusDot, Button, Table, Dialog, DropdownMenu,
                  Checkbox, Sparkline, UptimeHistory, etc.), Tailwind-styled. Presentation only —
                  no data-fetching, no @pcc/types import (see boundaries below).
  config/         Shared tsconfig.base.json, ESLint flat configs, Tailwind preset.
```

### Package boundaries — enforce these on every change

These were deliberate design constraints from scaffolding, not incidental:

- **`packages/types`** has zero runtime dependencies on anything else in the repo (verify: no
  `"dependencies"` key in its `package.json`, only `devDependencies`).
- **`packages/db`** only knows about schemas and data access — never imports `next`, `react`, or
  anything HTTP-routing-related. It depends on `@pcc/types` (type-only usage) and
  `longcelot-sheet-db`.
- **`packages/ui`** only knows about presentation — no data-fetching, no `@pcc/db` import. It
  deliberately does *not* import `@pcc/types` either (see `StatusDotTone` in
  `packages/ui/src/StatusDot.tsx`) — it only needs literal status strings, not the schema, so it
  stays a leaf-ish package independent of the rest of the data model.
- **`apps/web`** is the only place that composes `db` + `ui` + `types`. It should never contain
  schema definitions or reusable components that belong in a package — app-specific chrome
  (`NavBar`, route-aware bits) stays in `apps/web/src/components`, not `packages/ui`.
- **`apps/agent-bridge`** depends on `packages/db` and `packages/types` only — never on
  `apps/web`.

### ESLint setup

Split into `packages/config/eslint.config.base.mjs` (plain TS, no React — used by `types`, `db`,
`agent-bridge`) and `packages/config/eslint.config.react.mjs` (React rule additions, spread in
by `packages/ui` and `apps/web` alongside the base). This split exists because applying React
rules to pure-Node packages produced a bogus "React version not detected" warning — keep new
packages on whichever config actually matches what they ship.

### Version pins — don't casually bump these

- **ESLint is pinned to `^9.39.5`, not 10.x** — `eslint-plugin-react` (7.37.5, latest) crashes
  under ESLint 10's flat-config runtime (`context.getFilename is not a function`). Confirmed by
  testing, not a guess. Re-check this before upgrading.
- **TypeScript is pinned to `5.9.3`, not the `7.x` line** — TS 7 is a recent major rewrite; the
  surrounding tooling (typescript-eslint, etc.) targets TS 5 as of scaffolding.
- **Tailwind is pinned to `^3.4.19`, not v4** — v4 dropped the JS `tailwind.config.js` +
  `presets` array in favor of CSS-first `@theme` config; the shared preset in
  `packages/config/tailwind.preset.mjs` relies on the v3 preset API.

### Data layer (longcelot-sheet-db)

Single-user tool — one `admin` actor pointed at one Google Sheet (`ADMIN_SHEET_ID`), no
multi-tenant actor setup. Five tables defined in `packages/db/schemas/admin/`: `projects`,
`agents`, `ping_logs`, `command_queue`, `settings` (key/value, `secret` boolean — Render/Vercel
tokens etc., read/write via `/api/settings`; secrets are never echoed back once saved, see
`apps/web/src/app/api/settings/route.ts`). `packages/db/lsdb.config.ts` and the two
`.env.example` files (`packages/db/.env.example` for Google OAuth creds, `apps/web/.env.example`
for `RENDER_API_KEY`/`VERCEL_API_TOKEN`/auth vars/`CRON_SECRET`) are intentionally separate —
Sheets credentials vs. Render/Vercel credentials vs. portal-auth credentials are different
concerns. Note `packages/db`'s env vars must be *mirrored* into `apps/web/.env` too — Next.js
doesn't load env files from sibling packages, so the API routes (which run in the `apps/web`
process) need their own copy.

`boolean()` columns (e.g. `settings.secret`, `projects.has_health_endpoint`) render as a Sheets
dropdown (`TRUE`/`FALSE`), not a native checkbox — deliberate on lsdb's part, since the native
checkbox type writes a real `FALSE` into every blank cell it covers, which breaks how lsdb tells
a genuinely-empty row apart from an explicit `false`. An unset boolean cell staying truly blank
is correct, not a bug.

### Auth

Email/password *and* Google OAuth, single allowed identity (`AUTH_ALLOWED_EMAIL`) — resolves
plan.md §10's open auth decision. Gate lives in `apps/web/src/proxy.ts` (Next 16 renamed
`middleware.ts` → `proxy.ts`), not the layout, so unauthenticated requests redirect before any
page renders. New routes under `apps/web/src/app/api/auth/**`. See `apps/web/.env.example` for
the full var list (`GOOGLE_OAUTH_CLIENT_ID/SECRET`, `AUTH_ALLOWED_EMAIL`, `AUTH_PASSWORD_HASH`,
`AUTH_SESSION_SECRET`).

### Cron & thumbnails — resolved open decisions from plan.md §10

- **Cron:** GitHub Actions (`.github/workflows/health-check-cron.yml`, every 10 min, `CRON_SECRET`
  bearer auth against `GET /api/cron/health-check`) rather than Vercel Cron — Vercel's Hobby tier
  only allows daily schedules, too infrequent to keep a Render free-tier service warm.
- **Site thumbnails:** neither self-hosted Puppeteer nor a paid screenshot API — each frontend
  project's own Open Graph (`og:image`/`twitter:image`) meta tag is scraped instead
  (`apps/web/src/lib/og-image.ts`), no external service or API key needed.

### Design system

Dark-first "Mission Control" (spaceship command deck) theme — see the Design System section of
`Tasks/app-frontend.md` for the palette/motion rules. `UI-Clone/shadcn-admin` is a cloned
reference repo (Vite, not Next.js — don't fork it, port patterns from it): its
`src/styles/theme.css` oklch CSS-variable structure is the base the Mission Control palette
overrides, and its `src/components/ui/` has a larger shadcn/ui primitive set than
`packages/ui` currently does.
