# apps/web — Backend Tasks

All of this lives in `apps/web/src/app/api/**` (route handlers) and `apps/web/src/lib/**`
(external API clients). Business logic reads/writes through `@pcc/db` — never call
`createSheetAdapter` from here directly.

## 0. Foundations
- [x] `src/lib/render.ts` — Render API client: get service status, trigger wake, read `/health`
- [x] `src/lib/vercel.ts` — Vercel API client: deployment status, latest deploy timestamp
- [x] Resolve plan §10 cron decision: Vercel Cron (Pro plan) vs. scheduled GitHub Actions workflow hitting a route — resolved in favor of GitHub Actions (`.github/workflows/health-check-cron.yml`), see `Tasks/agent-chat.md` log for why
- [x] Env validation on boot (`RENDER_API_KEY`, `VERCEL_API_TOKEN` present) with a clear error, not a silent 500 — `src/lib/env.ts` + `withApiErrorHandling` in `src/lib/api-response.ts`

## 1. Projects API
- [x] `GET /api/projects` — list from `@pcc/db` `projectsTable()`
- [x] `POST /api/projects` — create, validate `type`/`platform` enums
- [x] `GET /api/projects/:id/health` — ping Render `/health`, write a `ping_logs` row, update `projects.status`/`last_checked`
- [x] `POST /api/projects/:id/wake` — trigger wake, poll until 200 or timeout, return final status
- [x] `cron/health-check` route — loop all backend projects, ping each, write `ping_logs` (the endpoint your scheduler hits)
- [x] `PATCH /api/projects/:id` — partial update of editable fields (not originally in this list; added once the frontend agent flagged it as blocking edit-project forms, see `Tasks/agent-chat.md`)

## 2. Agents API
- [x] `GET /api/agents` — list from `agentsTable()`
- [x] `POST /api/agents` — create (project ref, local path, brief, persona)
- [x] `PATCH /api/agents/:id` — pause/fire (status transitions only, no hard delete here)
- [x] `DELETE /api/agents/:id` — hard delete row
- [x] `POST /api/agents/:id/message` — phase 4+, depends on agent-bridge being ready; stub should 501 until then (left as-is, already correct)

## 3. Frontend status
- [x] Fold Vercel deployment status into `GET /api/projects` response (or a dedicated `/api/projects/:id/deploy-status` if it needs to stay separate for caching reasons) — went with the dedicated route, see its docstring

## 4. Cross-cutting
- [x] Rate-limit / de-dupe dashboard polling against Sheets' 60 reads/min quota (plan §11) — lean on lsdb's built-in 2s cache, don't fight it — cron loop is sequential rather than `Promise.all`, no extra polling infra added
- [x] Error shape convention: consistent `{ error: string }` JSON across all routes (already used by the 501 stubs — keep it) — `apiError`/`apiOk`/`withApiErrorHandling` in `src/lib/api-response.ts`, used everywhere
- [x] Settings tab read/write for tokens — `packages/db/schemas/admin/settings.ts` (key/value table, `secret` boolean) + `settingsTable()` helper + `apps/web/src/app/api/settings/route.ts` (`GET`/`POST`, generic key/value upsert, secrets masked on read). See `Tasks/agent-chat.md` log for details.
