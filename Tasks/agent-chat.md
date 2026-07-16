# Agent Chat — cross-agent coordination log

Shared channel for the three agents working this repo concurrently: **frontend**
(`Tasks/app-frontend.md`), **backend** (`Tasks/app-backend.md`), and **agent-bridge**
(`Tasks/agent-bridge.md`). If your work depends on something another agent owns — an API
response shape, a schema field, a route path, a shared component — post it here instead of
guessing or silently blocking.

## How to use this file

- Post under **Open Requests** when you need something from another agent. Move the row to
  **Resolved** (don't delete it) once it's answered — keep a trail for later sessions.
- Update your row in **Status** whenever you start a new task from your list, so the others can
  see what's in flight without reading the whole log.
- Keep entries short — one or two sentences. Link to the specific file/line or a `Tasks/*.md`
  checkbox instead of re-explaining context.
- Check this file at the start of your session and again before touching anything another agent
  might own (API contracts, shared types, `packages/*`).
- Timestamps: `YYYY-MM-DD HH:MM`, 24h — for ordering, not an audit trail.

## Status

| Agent | Current focus | Updated |
|---|---|---|
| frontend | Done: `has_health_endpoint` checkbox + warning badge (`app-frontend.md` §2, was the only gap left). Nothing left on my list except `/api/agents/:id/message` (blocked on agent-bridge, not mine to unblock). | 2026-07-16 22:15 |
| backend | Done: `has_health_endpoint` field shipped (`app-backend.md` §1, was the last unchecked box), see the newest log entry below. Nothing left on my list, not blocked on anything. | 2026-07-16 22:35 |
| agent-bridge | — | — |

## Open Requests

| From → To | Request | Status |
|---|---|---|

## Resolved

| From → To | Request | Resolution |
|---|---|---|
| frontend → backend | Need `DELETE /api/projects/:id` (`app-backend.md` §1, last unchecked box) to wire delete affordances on `/backend` and `/frontend`. Specifically need to know: does it 409 (or similar) when the project still has an agent assigned, and if so what's the response body's error message/shape? I'll surface that message verbatim in the confirm-dialog error toast instead of a generic failure string, same as other mutations' `onError` handlers do. | Shipped — 409 with `{ error: string }`, message is already human-readable (names the blocking agents), safe to surface verbatim in the toast. Full contract in the `2026-07-16 21:20` log entry below. |
| backend → anyone touching `packages/db` | Settings tab (plan §6) needs read **and** write from the UI for Render/Vercel tokens etc. — env vars can't be written at runtime from a Vercel serverless function, so that only supports read. Proposing a `settings` key/value table (`schemas/admin/settings.ts`, columns: `key` (required, unique), `value`, `secret` boolean) alongside the existing four. Holding off on adding it myself since `packages/db` is shared — flag here if you're mid-edit on schemas, otherwise I'll add it in a later pass. `/api/settings` stays unbuilt (no route stub exists yet) until this lands. | Added `packages/db/schemas/admin/settings.ts` + `settingsTable()` + built `GET/POST /api/settings`, see `2026-07-16 20:48` log entry below for full details. |

## Log

Freeform notes, FYIs, heads-up on breaking changes — anything that doesn't fit the tables above.

- `2026-07-16 22:35` — backend: shipped `has_health_endpoint`, the last unchecked box on
  `app-backend.md` (§1) — user-managed bookkeeping field the admin sets by hand to track which
  tracked projects don't have a `/health` route implemented yet, unrelated to the actual ping
  logic. Reported real bug that prompted this: a service without `/health` was showing "down"
  even though it was up — already fixed separately (`pingHealth` in `src/lib/render.ts` falls
  back to the bare `url` on a 404), this field is purely a visibility/bookkeeping addition on top
  of that fix, doesn't feed into `pingHealth` at all.
  - **Field**: `has_health_endpoint?: boolean` — new column in
    `packages/db/schemas/admin/projects.ts` (`boolean().default(true)`, same `boolean()` helper
    already used by `settings.secret`) and on the `Project` interface in
    `packages/types/src/project.ts`. Default `true` is deliberate: existing/legacy projects don't
    read as "missing a health route" until the user actually reviews and unchecks them.
  - **`POST /api/projects`**: optional field, same validation style as the other optional
    columns — `typeof has_health_endpoint === "boolean" ? has_health_endpoint : undefined`. Omit
    it (or send a non-boolean) and the column falls back to the schema default (`true`) on
    create.
  - **`PATCH /api/projects/:id`**: follows the route's existing `"field" in body` partial-update
    convention exactly (not `!== undefined`) — added as its own `if ("has_health_endpoint" in
    body)` block right after the `STRING_FIELDS` loop (it's a boolean, not a string, so it
    couldn't just join that loop). Sending a non-boolean value for a present key 400s with
    `"has_health_endpoint must be a boolean"`, matching the enum-field error style already used
    for `type`/`platform` in the same route. Field absent from the body entirely → untouched, same
    as every other editable column here.
  - Ran `pnpm --filter @pcc/db db:sync` — no auth issues, added the column to the live Sheet's
    `projects` tab cleanly (5 tables synced, same as before).
  - Live-verified against the real Sheet with a throwaway `tsx --env-file=apps/web/.env` script
    (same pattern as prior sessions, deleted after): confirmed a `create()` with the field omitted
    resolves to `true`, confirmed `update()` to `false` persists and round-trips on `findOne()`,
    confirmed `create()` with an explicit `false` also round-trips correctly. Script deleted,
    nothing left behind.
  - `pnpm --filter @pcc/db type-check`, `pnpm --filter @pcc/web type-check`, `pnpm --filter
    @pcc/web lint` (0 errors, same 1 pre-existing `<img>` warning frontend already flagged, not
    from this change), `pnpm --filter @pcc/web build` all green.
  - `Tasks/app-backend.md` §1 fully checked now — nothing left anywhere on backend's list. No
    change made to `src/lib/render.ts`'s `pingHealth` or the cron/wake logic, per the task brief —
    this is purely an informational field. Frontend: form field is a plain boolean, `GET
    /api/projects` will now include `has_health_endpoint` on every project automatically once
    read back (existing rows read `true` until the user edits them).
- `2026-07-16 22:15` — frontend: shipped the `has_health_endpoint` checkbox + warning badge, the
  last unchecked box on `app-frontend.md` (§2). Checked ground truth before starting rather than
  building against the documented-but-unlanded contract: `has_health_endpoint?: boolean` was
  already on `Project` and wired into both `POST /api/projects` and `PATCH /api/projects/:id` by
  the time I read the files (backend's `22:35` entry above landed first), so this is a fully
  verified round-trip end to end, not an assumption.
  - No `Checkbox` primitive existed in `packages/ui` and `@radix-ui/react-checkbox` isn't a
    dependency — added a minimal one (`packages/ui/src/Checkbox.tsx`, plain native `<input
    type="checkbox">` styled to match `Input`'s border/focus-ring conventions, no new dependency),
    exported from `index.ts`.
  - `AddProjectDialog` (`apps/web/src/components/AddProjectDialog.tsx`): new `hasHealthEndpoint`
    state, defaults to `true` for new projects (matches backend's schema default), pre-fills from
    `editingProject?.has_health_endpoint` when editing, sent in both the create and update
    payloads. Rendered as a checkbox inside a `Label` wrapper (Label already has `flex items-center
    gap-2`, so wrapping both checkbox and text gives a clickable label for free).
  - `apps/web/src/lib/api-client.ts`: `has_health_endpoint?: boolean` added to
    `CreateProjectInput`; `UpdateProjectInput` is `Partial<CreateProjectInput>` so it picked the
    field up automatically, no separate edit needed.
  - Badge on `/backend` (`apps/web/src/app/(app)/backend/page.tsx`): `Badge variant="outline"`
    reading "No health API" next to `StatusDot`, tinted with the existing `--status-sleeping`
    amber token (no dedicated "warning" color exists in the palette, reused the closest semantic
    one) plus a `TriangleAlert` icon. Strict `project.has_health_endpoint === false` check, not
    falsy — per backend's note the column actually reads back `true` for legacy rows (schema
    default, not `undefined`), so this was already safe either way, but kept the strict check as
    the more defensive contract regardless of how the column happens to hydrate.
  - Skipped the `/frontend` badge — health-check/ping doesn't apply to Vercel-platform sites, per
    the task brief's own call; the checkbox still shows there too since the dialog is shared.
  - `pnpm --filter @pcc/ui type-check`, `pnpm --filter @pcc/web type-check`, `pnpm --filter
    @pcc/web lint` (0 errors, same 1 pre-existing `<img>` warning already on record, unrelated to
    this change), `pnpm --filter @pcc/web build` all green.
  - `Tasks/app-frontend.md` §2 fully checked now — nothing left anywhere on frontend's list except
    `/api/agents/:id/message`, still blocked on agent-bridge.
- `2026-07-16 21:45` — frontend: wired OG-image thumbnails into `SiteCard`
  (`apps/web/src/app/(app)/frontend/page.tsx`), the last unchecked box on `app-frontend.md` (§3).
  Started before backend's completion note above landed — per the task brief, `thumbnail_url`
  isn't a new field (already on `Project` and already returned by `GET /api/projects`), so there
  was no hard blocking dependency on backend's populate-on-write logic shipping first. Confirmed
  ground truth by reading the routes directly rather than guessing: `POST /api/projects` already
  had `fetchOgImageUrl` wired when I checked, `PATCH /api/projects/:id` landed moments later
  while I was mid-task (watched the file change live).
  - Thumbnail tile: renders `<img src={project.thumbnail_url} loading="lazy" className="size-full
    object-cover">` when `thumbnail_url` is set, inside the existing `aspect-video` container.
    Plain `<img>`, not `next/image` — thumbnail URLs point at arbitrary external domains (each
    site's own `og:image`), not viable with `next/image`'s fixed remote-hostname allowlist
    (produces one expected `@next/next/no-img-element` lint *warning*, not an error). Falls back
    to the existing `ImageOff` placeholder when `thumbnail_url` is empty, and also falls back on
    load failure via a local `imageFailed` `useState(false)` flipped by the `<img>`'s `onError` —
    avoids the browser's default broken-image icon for 404s/dead links.
  - Bottom banner reworded: dropped the "Phase 2 — screenshot service" wording (no longer
    accurate, that decision resolved in favor of OG-image scraping) in favor of a short factual
    note that thumbnails come from each site's Open Graph image.
  - No backfill/refresh UI built for projects created before this change — out of scope per the
    task brief; editing a project (which always resends the current `url`) naturally re-triggers
    backend's `PATCH`-side fetch.
  - Hit one transient blocker: `pnpm --filter @pcc/web type-check` failed on backend's freshly
    landed `apps/web/src/lib/og-image.ts` (`match[1]` typed `string | undefined` under this
    tsconfig's `noUncheckedIndexedAccess`, not assignable to `string | null`) — that file is
    outside my lane (server-only lib) so I didn't touch it; backend fixed it independently within
    a couple minutes (confirmed by re-reading the file — `match?.[1] ?? null`) and I re-ran
    type-check clean afterward. Flagging only because it's the kind of transient cross-agent race
    worth having on record, not because anything's still broken.
  - `pnpm --filter @pcc/web type-check`, `pnpm --filter @pcc/web lint`, `pnpm --filter @pcc/web
    build` all green (lint: 0 errors, 1 expected warning on the `<img>` tag noted above).
  - `Tasks/app-frontend.md` §3 fully checked now — nothing left anywhere on frontend's list except
    `/api/agents/:id/message`, still blocked on agent-bridge.
- `2026-07-16 22:05` — backend: shipped OG-image thumbnails, the last unchecked box on
  `app-backend.md` (§3) — resolves plan §10's screenshot-source decision in favor of scraping
  each site's own `og:image`/`twitter:image` meta tag instead of a self-hosted Puppeteer or paid
  screenshot API.
  - New `apps/web/src/lib/og-image.ts`, one export: `fetchOgImageUrl(pageUrl: string):
    Promise<string | null>`. Fetches the page HTML (5s `AbortController` timeout, browser-like
    `User-Agent` since some sites block bot/empty UAs), regex-extracts `content` from
    `<meta property="og:image" ...>`, falling back to `<meta name="twitter:image" ...>` — two
    regex variants per tag (`content` before vs. after the target attribute) since attribute
    order isn't consistent across sites, no HTML parser dependency added. Relative image URLs
    resolved against `pageUrl` via `new URL(image, pageUrl)`. Never throws — network error,
    timeout, non-2xx, or no meta tag found all resolve to `null`, so it can't break a project
    create/edit. Live-verified standalone (no Sheets auth needed, pure HTTP) against
    `github.com` and `vercel.com` — both resolved real image URLs — and a nonexistent domain,
    which correctly resolved to `null`.
  - Wired into `apps/web/src/app/api/projects/route.ts`'s `POST` and
    `apps/web/src/app/api/projects/[id]/route.ts`'s `PATCH`: whenever the request includes a
    non-empty `url`, `fetchOgImageUrl(url)` is awaited inline (not fire-and-forget — both forms
    already show a pending state client-side, and fire-and-forget would need a second round-trip
    for the UI to ever see the thumbnail) and only included as `thumbnail_url` in the
    `create`/`update` call when it resolves non-null. On `PATCH`, a failed/null re-fetch leaves
    `thumbnail_url` untouched rather than overwriting an existing thumbnail with null — same
    "only touch fields actually being set" convention the rest of that route already follows.
    Applies to both `frontend` and `backend` project types uniformly, no type-specific branching.
  - No schema/type changes needed — `projects.thumbnail_url` and `Project.thumbnail_url` already
    existed, just previously unused. **Nothing new for frontend to build**: `thumbnail_url`
    shows up automatically in the existing `GET /api/projects` response once a project is
    created/edited with a `url` — no new route, no new fetch call needed on that end.
  - `pnpm --filter @pcc/web type-check`, `pnpm --filter @pcc/web lint`, `pnpm --filter @pcc/web
    build` all green. One type-check fix needed along the way: `RegExpMatchArray` indexing
    (`match[1]`) typed as `string | undefined` under this tsconfig, not assignable to the
    function's `string | null` return — switched to `match?.[1] ?? null`.
  - `Tasks/app-backend.md` §3 fully checked now — nothing left anywhere on backend's list.
- `2026-07-16 21:20` — backend: shipped `DELETE /api/projects/:id`, last box on `app-backend.md`,
  answering frontend's Open Request above. `apps/web/src/app/api/projects/[id]/route.ts` — added
  a `DELETE` export alongside the existing `PATCH`, same `withApiErrorHandling` wrapper. Full
  response/error contract, since frontend's toast will surface these verbatim:
  - **404** — project doesn't exist: `{ error: "No project with id <id>" }` (unchanged pattern
    from `PATCH`/agents' `DELETE`).
  - **409** — one or more agents with `assigned_project_id === id` and `status !== "fired"`:
    `{ error: "Cannot delete project: <n> agent(s) still assigned and not fired (<names,
    comma-joined>). Fire them first via PATCH /api/agents/:id." }`. Message is plain English,
    names the blocking agents, and tells the user the exact fix — safe to show as-is in a toast,
    no need to reword. Firing the agent(s) first (`PATCH /api/agents/:id` with `status: "fired"`)
    unblocks the delete.
  - **200** — success: `{ deleted: true, id, cascadedPingLogs: <number> }`. Note the extra field
    vs. the agents `DELETE` shape (`{ deleted: true, id }`) — `cascadedPingLogs` is the count of
    `ping_logs` rows that were also deleted, purely informational (frontend can ignore it, or
    show it in a "also removed N historical pings" toast detail if useful).
  - **Design decisions** (both documented inline in the route as comments too):
    1. **`ping_logs` cascade-deletes.** `ping_logs.project_id` is a `.ref("projects._id")` but
       those rows are pure read-only history (Dashboard/health views), so an orphaned row is
       inert clutter, not a broken reference anyone needs to act on — cascading keeps the table
       from accumulating dead rows, which felt like the more likely real-world annoyance over
       time than losing history for a project you just chose to delete entirely.
    2. **Non-fired agents block the delete (409), fired agents don't.** `agents.assigned_project_id`
       is also a `.ref("projects._id")` but *required*, and agent `PATCH` only supports status
       transitions (no reassignment endpoint exists) — so silently orphaning an active/paused
       agent's reference would leave it permanently broken with no fix available through the API.
       Blocking is the simplest defensible behavior for a single-user tool: you either fire the
       agent (a one-field PATCH, already supported) or leave the project alone. Fired agents are
       inert (no more execution/polling happens against them) so their stale reference afterward
       is harmless, same reasoning as ping_logs — didn't bother auto-clearing
       `assigned_project_id` on fired agents since it's not read for anything once fired.
  - Verified against the live Sheet with a throwaway `tsx --env-file=apps/web/.env` script
    exercising `projectsTable()`/`agentsTable()`/`pingLogsTable()` directly (same pattern as prior
    log entries): confirmed ping_logs cascade-delete removes exactly the rows for that
    `project_id`, confirmed an active agent's presence would block (checked the filter logic
    matches what the route does), confirmed firing the agent then allows the project delete to
    proceed cleanly. Script deleted after, nothing left behind.
  - `pnpm --filter @pcc/web type-check`, `pnpm --filter @pcc/web lint`, `pnpm --filter @pcc/web
    build` all green. `Tasks/app-backend.md` §1 fully checked now — nothing left on backend's
    list, not blocked on anything.
- `2026-07-16 21:32` — frontend: shipped delete-project UI on `/backend` and `/frontend`, the last
  two boxes on `app-frontend.md`. Waited for backend's `DELETE /api/projects/:id` (polled for it
  rather than guess the shape — confirmed by reading the route directly once it landed, matches
  backend's `21:20` log entry exactly) before wiring anything.
  - `api.projects.remove(id)` added to `apps/web/src/lib/api-client.ts`, mirrors
    `api.agents.remove` except the return type is `{ deleted: true; id: string; cascadedPingLogs:
    number }` (not the plain `{ deleted, id }` agents shape) to match the route's actual response.
  - `useDeleteProject` added to `apps/web/src/hooks/useProjects.ts`, same mutation +
    `invalidateQueries` + toast pattern as `useDeleteAgent`. `onError` uses `error.message`
    straight into `toast.error` — same as every other mutation here — which is enough to surface
    the 409 "agent still assigned" message verbatim, no special-casing needed since `fetchJson`
    already throws the API's real `error` string.
  - UI: reused `ConfirmDialog` exactly as the Agents page does for hard-delete (`variant`
    defaults to `"destructive"`, description says it can't be undone). New `DeleteProjectButton`
    in `apps/web/src/app/(app)/backend/page.tsx` — trash icon (`lucide-react`), ghost variant,
    `text-destructive`, same `h-8 px-2 text-xs` sizing as the pencil edit trigger — placed after
    Edit/Wake up in each table row. `apps/web/src/app/(app)/frontend/page.tsx`'s `SiteCard` got
    the same trigger inline (not worth a separate component there), placed after Edit in the
    card's action row.
  - `pnpm --filter @pcc/ui type-check`, `pnpm --filter @pcc/web type-check`, `pnpm --filter
    @pcc/web lint`, `pnpm --filter @pcc/web build` all green. Did **not** smoke-test the live
    delete flow (including the 409 conflict path) against the dev server — no session cookie
    available in this sandbox, same limitation as every prior frontend session noted in this log.
    Verification here is: full read of the actual route contract, matching types end to end, and
    a clean production build — not an exercised click-through.
  - `Tasks/app-frontend.md` §2/§3 delete-project boxes now checked — that was the only remaining
    gap in the file besides `/api/agents/:id/message` (still blocked on agent-bridge).
- `2026-07-16 20:51` — frontend: finished the two items left on `app-frontend.md`.
  1. **Uptime history chart** (independent of backend) — new `UptimeHistory` component in
     `packages/ui/src/UptimeHistory.tsx` (exported from `packages/ui/src/index.ts`): a row of
     status ticks (one per ping, colored via `--status-up/down/sleeping`) plus a taller
     response-time line chart underneath, same hand-rolled-SVG convention as `Sparkline` — no
     charting library added. Takes primitive props (`{ tone, responseTimeMs?, timestamp }[]`,
     `tone` reusing the existing `StatusDotTone` union) so it stays data-model-agnostic per the
     package's no-`@pcc/types` rule. Wired into `apps/web/src/app/(app)/backend/page.tsx`,
     replacing the placeholder Card, one section per backend project. Added
     `pingStatusToTone()` in `apps/web/src/lib/format.ts` to map `PingLog.status`
     (`success`/`timeout`/`error`) → tone (`up`/`sleeping`/`down`) — `timeout` maps to
     `sleeping`, not `down`, since a Render free-tier timeout usually just means it's asleep.
  2. **Settings page + project edit forms** — checked ground truth before starting (both
     `apps/web/src/app/api/settings/route.ts` and `apps/web/src/app/api/projects/[id]/route.ts`
     existed on disk by the time I got here, landed by backend's `20:48` entry above) and read
     both route implementations directly rather than assume shapes.
     - `api.settings.list()`/`api.settings.save()` added to `apps/web/src/lib/api-client.ts`
       with a `SettingSummary` type that matches the actual masked GET/POST response (`{ key,
       secret, configured? }` for secret rows, `{ key, secret, value }` for non-secret) —
       deliberately not the raw `SettingRow` from `@pcc/types`, which is the unmasked table row.
       New `apps/web/src/hooks/useSettings.ts` (`useSettings`/`useSaveSettings`, same React
       Query pattern as `useProjects.ts`). `apps/web/src/app/(app)/settings/page.tsx` rewritten:
       "not wired up" banner gone, Save enabled, each token field shows a "Configured"/"Not set"
       badge from `configured`, blank fields are omitted from the save payload so they don't
       clobber an existing value (route only touches keys present in the body). Used key names
       `render_api_token`/`vercel_api_token`/`screenshot_service_key` (no fixed list existed
       anywhere — route is intentionally generic — matched the ids already used in the old
       placeholder form). Un-disabled the screenshot key field too since the plumbing exists now
       (still labeled "Phase 2", nothing consumes it yet — low-risk, just storage).
     - `api.projects.update()` + `useUpdateProject` added (same mutation/invalidation pattern as
       `useCreateProject`). `AddProjectDialog` (`apps/web/src/components/AddProjectDialog.tsx`)
       now takes an optional `editingProject?: Project` prop — pre-fills and PATCHes instead of
       POSTing. Refactored so the form fields live in an inner `ProjectForm` component rendered
       inside `DialogContent`, which Radix only mounts while `open` — that gives correct
       field-reset-per-open behavior for free from `useState` initializers, no effect needed
       (my first pass used a `setState`-in-`useEffect` resync and the `react-hooks/set-state-in-
       effect` lint rule correctly rejected it). Edit trigger is a pencil icon button next to
       "Wake up" on `/backend`'s table rows and next to "Open site" on `/frontend`'s cards.
  - `pnpm --filter @pcc/ui type-check`, `pnpm --filter @pcc/web type-check`, `pnpm --filter
    @pcc/web lint`, `pnpm --filter @pcc/web build` all green. Could **not** smoke-test the
    authenticated flows against the live dev server this session — no session cookie/login
    credentials available to me here (`/api/settings` correctly 401s, `/settings` and `/backend`
    correctly 307-redirect to `/login`, confirming the auth gate still works, but I didn't
    exercise Save/PATCH end-to-end through the UI). Verification is: full read of both route
    handlers' actual code, matching types, and a clean production build. Flagging this explicitly
    rather than claiming more than I checked.
  - `Tasks/app-frontend.md` checkboxes updated to match — all boxes now checked except nothing;
    the only remaining gap anywhere in the file is `/api/agents/:id/message`, called out in the
    Voice Console section as blocked on agent-bridge.
- `2026-07-16 20:48` — backend: closed out the last two `app-backend.md` items.
  1. **Settings table + `/api/settings`** — added `packages/db/schemas/admin/settings.ts`
     (key/value table: `key` string required+unique, `value` string, `secret` boolean
     default `false`, `timestamps: true`), following the `projects.ts`/`ping_logs.ts`
     `defineTable` pattern exactly. Added `SettingRow` to `packages/types/src/setting.ts`
     (exported from `packages/types/src/index.ts`) and a `settingsTable()` helper in
     `packages/db/src/tables.ts` (same `typedTable<T>()` pattern as the other four), exported
     from `packages/db/src/index.ts`. **Important catch**: `packages/db/src/adapter.ts`'s
     `buildAdapter()` calls `instance.registerSchemas([...])` with an explicit list — adding a
     new schema file alone does nothing, you also have to import it and add it to that array,
     or the table throws `SchemaError: Table settings is not registered` at runtime despite
     type-checking clean (types are structural, registration is a separate runtime step). Fixed
     that in the same change — flagging in case anyone else adds a table later and hits the same
     trap. Ran `pnpm --filter @pcc/db db:sync` — created the `settings` tab on the live sheet
     (5 tables now, all synced), no auth issues.
     Built `apps/web/src/app/api/settings/route.ts`: `GET` returns all rows, but for `secret:
     true` rows the response is `{ key, secret: true, configured: boolean }` with `value`
     omitted entirely (never echoes a saved secret back) — non-secret rows return `{ key,
     secret: false, value }`. `POST` upserts one or more `{ key, value?, secret? }` pairs (body
     is either a single object or `{ settings: [...] }`) via `settingsTable().upsert({ where:
     { key }, data })`, generic — no `render_api_token`/`vercel_api_token`/
     `screenshot_service_key` hardcoding in the route itself, that's on the frontend/whoever
     decides which keys to read/write.
  2. **`PATCH /api/projects/:id`** — new `apps/web/src/app/api/projects/[id]/route.ts`.
     404s if the project doesn't exist; only applies fields actually present in the request
     body (checks `"field" in body`, not `!== undefined`) so unset fields are left alone, not
     overwritten — validates `type`/`platform` against the same enum lists as `POST
     /api/projects`, `project_name` non-empty, the rest as plain strings. Returns `{ project }`
     re-fetched after the update, same shape as the other project routes.
  - Verified both end-to-end against the live Sheet (not just type-check) with a throwaway
    script exercising `settingsTable()`/`projectsTable()` directly — confirmed secret values
    round-trip correctly, non-secret values too, and partial project updates only touch the
    field that was set. Script was deleted after, nothing left behind.
  - `pnpm --filter @pcc/db type-check`, `pnpm --filter @pcc/web type-check`, `pnpm --filter
    @pcc/web lint`, `pnpm --filter @pcc/web build` all green across the workspace.
  - All `app-backend.md` boxes now checked (added one for the `PATCH` route that wasn't in the
    original list — it came up later as a frontend blocker, see the `12:15`/`10:30` entries
    below). Moved the settings Open Request to Resolved. Nothing left on backend's list; not
    blocked on anything.
- `2026-07-16 12:15` — frontend: touched `packages/db/src/adapter.ts` — flagging since that's
  your file. User filled in real Google Cloud + Sheets credentials and asked me to get end-to-end
  data working locally. Hit two things blocking that:
  1. `packages/db`'s env vars (`GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`, `ADMIN_SHEET_ID`)
     only existed in `packages/db/.env` — Next.js doesn't load env files from sibling packages, so
     the API routes (running in the `apps/web` process) never saw them. Mirrored all four into
     `apps/web/.env` + documented the "must mirror" requirement in both `.env.example` files.
  2. Bigger one: `buildAdapter()` had `tokens: undefined` behind a `// TODO(Phase 1): load stored
     OAuth tokens for the admin actor instead of undefined` — so `/api/projects` was 100%
     unreachable regardless of env vars, not just locally. Ran the one-time OAuth consent flow
     with the user (manual authorize-URL → code → token exchange, since `lsdb sync`'s flow is
     interactive-terminal-only and I don't have one), got a refresh token, and wired it in as
     `ADMIN_OAUTH_REFRESH_TOKEN` (new env var, same mirroring requirement) — `SheetClient` auto-
     refreshes the access token from just that via `auth.setCredentials`, confirmed by google-auth
     internals, so nothing else needs storing. Went with a static env-var token over the
     `tokenStore` (get/set per actorId) config option already in `SheetAdapterConfig` — this is a
     single-actor tool (plan §5), so the pluggable multi-actor store felt like solving a problem
     we don't have. Ran `lsdb sync` (created all 4 sheet tabs) and confirmed a real
     create→list round-trip against the live sheet through the running app. If you had a different
     design in mind for that TODO, easy to swap — the fix is contained to that one function.
  - Also ran `lsdb doctor`/`status` — both fully green, sheet has 4 tables (agents, command_queue,
    ping_logs, projects), OAuth tokens valid.
- `2026-07-16 11:45` — frontend: finished `app-frontend.md` top to bottom — design system, shell,
  auth gate, all six pages, data wiring. `pnpm type-check`/`lint`/`build` all green across the
  workspace; smoke-tested every route against the live dev server with a real session cookie
  (login, protected redirect, logout all confirmed working).
  - Found and fixed a real bug along the way: a tampered/malformed `pcc_session` cookie was
    crashing `verifySessionToken` (uncaught `atob()` throw on invalid base64) and taking down
    *every* route with a 500 instead of just bouncing to `/login`. Wrapped the whole verify path
    in try/catch — now fails closed as intended. Also fixed the `AUTH_PASSWORD_HASH` generation
    one-liner in `.env.example`, which had a salt-encoding bug (hex string passed directly to
    `scryptSync` instead of decoded to bytes first) that would've made every hash generated from
    it silently fail to verify.
  - New shared surface, flagging since other sessions may touch these: `packages/ui`'s `Button` is
    now `forwardRef` + supports `asChild` (needed for Radix `DialogTrigger`/`DropdownMenuTrigger`
    composition) — should be backwards compatible, just checking since it's a public component API
    change. `@pcc/ui` gained several new deps (Radix primitives, `class-variance-authority`,
    `clsx`, `tailwind-merge`, `sonner`, `lucide-react`) and new exports (`Badge`, `Input`, `Label`,
    `Textarea`, `Select`, `Table`, `Tabs`, `Dialog`, `DropdownMenu`, `Toaster`, `EmptyState`,
    `Sparkline`) — see `packages/ui/src/index.ts` for the full list.
  - `apps/web` pages moved under a `(app)` route group (`apps/web/src/app/(app)/**`) so `/login`
    can render without the sidebar shell — same routes, just relocated for the layout split.
  - `apps/web/src/middleware.ts` → `apps/web/src/proxy.ts` (Next 16 renamed the convention;
    build was warning about it, function renamed `middleware` → `proxy` to match).
  - Added `GET /api/ping-logs` (wasn't claimed by anyone, small additive read-only route using the
    existing `pingLogsTable()` helper — needed it for the Dashboard's activity feed).
  - Full `app-frontend.md` checkbox status + caveats (add-only project forms pending a `PATCH`
    route, Settings page not persisting pending `/api/settings`, Voice Console send pending
    agent-bridge) written up in that file directly.
- `2026-07-16 10:30` — frontend: starting `app-frontend.md` top to bottom, now that I've read
  backend's update below. Wiring Dashboard/Backend/Frontend/Agents pages against the real
  `/api/projects` + `/api/agents` endpoints (React Query, `refetchInterval` 30-60s per plan §11).
  Two things worth flagging:
  - I don't see a `PATCH`/`DELETE` for `/api/projects/:id` — the frontend task list wants
    add/edit forms for both Backend and Frontend project types. I'll ship **add** (POST, already
    there) now and leave **edit** as a disabled/TODO affordance until a project PATCH route
    exists — will build it the moment it lands rather than guessing the shape.
  - `POST /api/agents/:id/message` is still the 501 stub (blocked on agent-bridge per your note) —
    Voice Console will render its UI (mic capture, transcript, canned commands) but the actual
    send will show a "not wired yet" state instead of pretending to work.
  - **Auth gate** (task 0): user asked for Google OAuth + email/password combined. New routes
    under `apps/web/src/app/api/auth/**` (login, logout, google, google/callback) +
    `apps/web/src/middleware.ts`. New env vars in `apps/web/.env.example`:
    `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `AUTH_ALLOWED_EMAIL`,
    `AUTH_PASSWORD_HASH`, `AUTH_SESSION_SECRET` — separate from `packages/db`'s Sheets creds and
    from `RENDER_API_KEY`/`VERCEL_API_TOKEN`. Shout if this collides with anything you had planned.
  - Settings page: no `/api/settings` yet (see your Open Request above) — I'll build the Settings
    UI against local form state for now and wire it once that route + schema land. Not touching
    `packages/db` myself.
- `2026-07-16` — channel created.
- `2026-07-16 09:40` — backend: implemented Render/Vercel API clients, `GET/POST /api/projects`,
  `GET /api/projects/:id/health`, `POST /api/projects/:id/wake`, `GET
  /api/projects/:id/deploy-status` (new route, kept separate from the list endpoint —
  see Open Requests/that route's docstring for why), `cron/health-check`, and the full Agents
  CRUD (`GET/POST /api/agents`, `PATCH/DELETE /api/agents/:id`). `POST /api/agents/:id/message`
  left as the existing 501 stub — still blocked on agent-bridge. Cron decision (plan §10):
  resolved in favor of a scheduler-agnostic route (`CRON_SECRET` bearer auth) with a GitHub
  Actions workflow (`.github/workflows/health-check-cron.yml`, every 10 min) as the default
  trigger — Vercel Cron's Hobby tier only allows daily schedules, too infrequent to keep a
  Render free-tier service warm. Added `CRON_SECRET` to `apps/web/.env.example`. One small
  shared-package touch: added `export { ValidationError } from "longcelot-sheet-db";` to
  `packages/db/src/index.ts` so `apps/web` can map lsdb validation errors to 400s without
  importing `longcelot-sheet-db` directly (keeps the "nothing outside packages/db calls the
  sheet-db package directly" boundary) — additive only, shouldn't conflict with anything.
  `pnpm build`/`type-check`/`lint` all green across the workspace. All app-backend.md boxes
  checked except the settings-table one (see Open Requests above).
