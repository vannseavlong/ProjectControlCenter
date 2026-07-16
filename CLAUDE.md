# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Project Control Center — a portal that monitors Render backend uptime, Vercel frontend deploy
status, and manages a roster of Claude Code agents assigned to local projects, with a voice
console to talk to them. Full architecture, data model, and phased build order live in
[project-control-center-plan.md](./project-control-center-plan.md) — read it before making
product decisions.

**Current state: structure-only scaffold.** Routes, API stubs, and package boundaries exist;
no business logic (health pinging, wake-up polling, agent execution, voice) is implemented yet.
API routes under `apps/web/src/app/api/**` all return `501 Not Implemented` until Phase 1 work
lands. Don't assume a route does anything just because it exists.

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
  types/          Shared TS interfaces: Project, Agent, PingLog, Command + their enum unions.
                  Zero runtime dependencies — this is the leaf of the dependency graph.
  db/             longcelot-sheet-db schemas (schemas/admin/*.ts) + a typed adapter singleton
                  (src/adapter.ts, src/tables.ts). Exports getAdapter()/getAdminContext() and
                  typed table helpers (projectsTable(), agentsTable(), pingLogsTable(),
                  commandQueueTable()). Nothing outside this package calls createSheetAdapter
                  directly.
  ui/             Shared React primitives (Card, StatusDot, Button), Tailwind-styled.
                  Presentation only.
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
multi-tenant actor setup. Four tables defined in `packages/db/schemas/admin/`: `projects`,
`agents`, `ping_logs`, `command_queue` (mirrors plan.md §5). `packages/db/lsdb.config.ts` and
the two `.env.example` files (`packages/db/.env.example` for Google OAuth creds,
`apps/web/.env.example` for `RENDER_API_KEY`/`VERCEL_API_TOKEN`) are intentionally separate —
Sheets credentials vs. Render/Vercel credentials are different concerns.

### Design system

Dark-first "Mission Control" (spaceship command deck) theme — see the Design System section of
`Tasks/app-frontend.md` for the palette/motion rules. `UI-Clone/shadcn-admin` is a cloned
reference repo (Vite, not Next.js — don't fork it, port patterns from it): its
`src/styles/theme.css` oklch CSS-variable structure is the base the Mission Control palette
overrides, and its `src/components/ui/` has a larger shadcn/ui primitive set than
`packages/ui` currently does.
