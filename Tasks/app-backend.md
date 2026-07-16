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
- [x] `DELETE /api/projects/:id` — hard delete, same pattern as `DELETE /api/agents/:id` (404 if missing, `{ deleted: true, id }` on success). Needed so Backend Services and Frontend Sites have a way to remove a project, not just add/edit — see `Tasks/app-frontend.md` task 2/3. Cascades `ping_logs` (harmless history), blocks with 409 if a non-fired agent is still assigned — see `Tasks/agent-chat.md` log for details.
- [x] Auto-detect `has_health_endpoint`, user-requested follow-up to the manual checkbox above —
      `pingHealth()` (`src/lib/render.ts`) now returns `healthEndpointDetected: boolean | null`
      (derived from the *direct* `/health` attempt only, before any bare-`url` fallback): `true` on
      2xx, `false` on a real non-2xx response, `null` on a timeout (inconclusive — service may just
      be asleep, don't guess). Wired into every place a backend project's `/health` already gets
      pinged, so this piggybacks on existing network calls rather than adding new ones:
        - `POST /api/projects` / `PATCH /api/projects/:id` — probe inline (5s timeout, shorter than
          the 10s default, so a slow/cold service doesn't make Add/Edit feel hung) when a `url` is
          being set on a `type: "backend"` project, run concurrently with the OG-image thumbnail
          fetch. A conclusive result **overrides whatever the form's checkbox submitted** in that
          same request — live detection beats a guess, but the checkbox still governs when the
          probe is inconclusive (new project, timeout, no url, or a frontend-type project).
        - `GET /api/projects/:id/health`, `POST /api/projects/:id/wake` — both already ping/wake
          the service; if the result is conclusive, fold `has_health_endpoint` into the
          `status`/`last_checked` update they already do. Inconclusive → field untouched.
        - `cron/health-check` — same, applied per-project inside the existing scheduled loop. This
          is what makes the field self-correcting over time with zero extra requests: add a
          `/health` route to a service later, and the next cron pass (already pinging it anyway)
          picks it up automatically without anyone touching the checkbox.
      No behavior change to `status`/`sleeping`/`down` determination — this only ever writes to
      `has_health_endpoint`, alongside the fields those routes already update.
- [ ] Search/pagination for `GET /api/projects`, user-requested (see `Tasks/app-frontend.md` §2/§3
      for the actual UI ask) — **decision made, no route work planned yet**: default to doing
      search + pagination entirely client-side over the list this route already returns in full.
      Reasoning: the app already fetches the whole project list once via React Query on both
      `/backend` and `/frontend` and derives everything (type filter, sparklines, etc.)
      client-side, and plan §11 notes lsdb is comfortably fine for hundreds to low-thousands of
      rows — nowhere near where server-side paging would earn its cost in added route complexity.
      Only revisit this (adding optional `?search=&page=&limit=` query params here) if the roster
      genuinely grows large enough that shipping the full list on every load becomes a real
      problem — not a concern at current or foreseeable scale for a personal project registry.

## 2. Agents API
- [x] `GET /api/agents` — list from `agentsTable()`
- [x] `POST /api/agents` — create (project ref, local path, brief, persona)
- [x] `PATCH /api/agents/:id` — pause/fire (status transitions only, no hard delete here)
- [x] `DELETE /api/agents/:id` — hard delete row
- [x] `POST /api/agents/:id/message` — phase 4+, depends on agent-bridge being ready; stub should 501 until then (left as-is, already correct)

## 3. Frontend status
- [x] Fold Vercel deployment status into `GET /api/projects` response (or a dedicated `/api/projects/:id/deploy-status` if it needs to stay separate for caching reasons) — went with the dedicated route, see its docstring
- [x] Site thumbnails via Open Graph image — resolves plan §10's screenshot-source open decision
      (self-hosted Puppeteer vs. third-party screenshot API) in favor of neither: scrape each
      frontend project's own `og:image`/`twitter:image` meta tag and persist to the existing
      (currently unused) `projects.thumbnail_url` column on create/update. No new schema, no new
      route, no external service or API key. `src/lib/og-image.ts` (`fetchOgImageUrl`), wired into
      `POST /api/projects` and `PATCH /api/projects/:id` — see `Tasks/agent-chat.md` log for
      details, frontend just reads `project.thumbnail_url` off the existing `GET /api/projects`
      response.
- [x] `has_health_endpoint` field on `projects` — a user-managed boolean (not auto-detected) so the
      admin can mark which services don't have a `/health` route implemented yet, separate from
      `status`/`last_checked` (which reflect the last actual ping result, not whether a route
      exists at all). Add the column to `packages/db/schemas/admin/projects.ts` (`boolean()`,
      `.default(true)` — assume yes unless told otherwise, so existing/legacy rows created before
      this column don't read as flagged-missing until the user actually reviews them) and to the
      `Project` type in `packages/types/src/project.ts`. Accept it in the request body of both
      `POST /api/projects` and `PATCH /api/projects/:id` (same optional-field pattern as the other
      editable columns in those routes). Run `pnpm --filter @pcc/db db:sync` after the schema
      change. No behavior change to the actual health-check/cron/wake logic — this field is purely
      informational, the ping logic (`src/lib/render.ts`'s `pingHealth`, already has its own
      `/health`-then-bare-`url` fallback) is untouched. See `Tasks/app-frontend.md` for the
      matching form field + display badge.
- [x] Generic URL-reachability check for non-Vercel frontend hosting, user-requested (e.g. Firebase
      Hosting, Netlify, GitHub Pages, a custom server) — Vercel's `readyState` only exists for
      Vercel-hosted projects, so a frontend site hosted elsewhere currently has no live/down signal
      at all. **Design decided, not yet built:**
        - Add a `pingUrl()`-style helper (mirrors `pingHealth()` in `src/lib/render.ts`, but pings
          the bare project `url` directly — no `/health` assumption, since a static frontend host
          won't have an API health route). Doesn't belong in `render.ts` (that's Render-specific
          naming/docs) — put it somewhere platform-agnostic, e.g. a new `src/lib/reachability.ts`.
        - `ProjectPlatform` (`packages/types/src/project.ts`) is currently a strict
          `"vercel" | "render"` enum — add an `"other"` value (or similar) for frontend projects
          hosted somewhere else, so the form/backend know when to skip the Vercel deploy-status
          call entirely and use this check instead.
        - **Use this as the signal only when there's no Vercel data available** (platform isn't
          `"vercel"`, or no `vercel_project_id` set) — do **not** combine it with Vercel's
          `readyState` for Vercel-hosted projects. Reasoning: combining both adds real
          reconciliation complexity (what wins if Vercel says `READY` but the URL ping times out
          right after a deploy, e.g. DNS/CDN propagation lag?) and doubles the network calls, for
          a case that already works correctly today. Fallback-only keeps this scoped to the actual
          gap (non-Vercel hosting) without touching what isn't broken.
      No frontend UI counterpart planned beyond the `platform` dropdown gaining the new option —
      this is scoped as backend-only.

## 4. Cross-cutting
- [x] Rate-limit / de-dupe dashboard polling against Sheets' 60 reads/min quota (plan §11) — lean on lsdb's built-in 2s cache, don't fight it — cron loop is sequential rather than `Promise.all`, no extra polling infra added
- [x] Error shape convention: consistent `{ error: string }` JSON across all routes (already used by the 501 stubs — keep it) — `apiError`/`apiOk`/`withApiErrorHandling` in `src/lib/api-response.ts`, used everywhere
- [x] Settings tab read/write for tokens — `packages/db/schemas/admin/settings.ts` (key/value table, `secret` boolean) + `settingsTable()` helper + `apps/web/src/app/api/settings/route.ts` (`GET`/`POST`, generic key/value upsert, secrets masked on read). See `Tasks/agent-chat.md` log for details.
