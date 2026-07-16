# apps/web — Backend Tasks

All of this lives in `apps/web/src/app/api/**` (route handlers) and `apps/web/src/lib/**`
(external API clients). Business logic reads/writes through `@pcc/db` — never call
`createSheetAdapter` from here directly.

## 0. Foundations
- [ ] `src/lib/render.ts` — Render API client: get service status, trigger wake, read `/health`
- [ ] `src/lib/vercel.ts` — Vercel API client: deployment status, latest deploy timestamp
- [ ] Resolve plan §10 cron decision: Vercel Cron (Pro plan) vs. scheduled GitHub Actions workflow hitting a route
- [ ] Env validation on boot (`RENDER_API_KEY`, `VERCEL_API_TOKEN` present) with a clear error, not a silent 500

## 1. Projects API
- [ ] `GET /api/projects` — list from `@pcc/db` `projectsTable()`
- [ ] `POST /api/projects` — create, validate `type`/`platform` enums
- [ ] `GET /api/projects/:id/health` — ping Render `/health`, write a `ping_logs` row, update `projects.status`/`last_checked`
- [ ] `POST /api/projects/:id/wake` — trigger wake, poll until 200 or timeout, return final status
- [ ] `cron/health-check` route — loop all backend projects, ping each, write `ping_logs` (the endpoint your scheduler hits)

## 2. Agents API
- [ ] `GET /api/agents` — list from `agentsTable()`
- [ ] `POST /api/agents` — create (project ref, local path, brief, persona)
- [ ] `PATCH /api/agents/:id` — pause/fire (status transitions only, no hard delete here)
- [ ] `DELETE /api/agents/:id` — hard delete row
- [ ] `POST /api/agents/:id/message` — phase 4+, depends on agent-bridge being ready; stub should 501 until then

## 3. Frontend status
- [ ] Fold Vercel deployment status into `GET /api/projects` response (or a dedicated `/api/projects/:id/deploy-status` if it needs to stay separate for caching reasons)

## 4. Cross-cutting
- [ ] Rate-limit / de-dupe dashboard polling against Sheets' 60 reads/min quota (plan §11) — lean on lsdb's built-in 2s cache, don't fight it
- [ ] Error shape convention: consistent `{ error: string }` JSON across all routes (already used by the 501 stubs — keep it)
- [ ] Settings tab read/write for tokens — decide storage (env vars only vs. a `settings` sheet table) before building `/api/settings`
