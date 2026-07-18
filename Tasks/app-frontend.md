# apps/web — Frontend Tasks

UI kit: adopt **shadcn/ui** components directly into `packages/ui` (copy-paste style, not a
dependency) and use [shadcn-admin](https://github.com/satnaing/shadcn-admin) as a layout/pattern
reference only — it's a Vite app, not Next.js, so don't fork it; port the patterns (sidebar shell,
data table, command palette) that fit our App Router structure.

> **Reference clone:** `UI-Clone/shadcn-admin` — check here first before building any component
> from scratch. Concretely reusable pieces:
> - `src/components/layout/` (`app-sidebar.tsx`, `header.tsx`, `main.tsx`, `nav-group.tsx`,
>   `nav-user.tsx`) — the sidebar shell for task 0 below
> - `src/components/ui/` — a much larger primitive set than we have yet (`sidebar`, `sheet`,
>   `command`, `dropdown-menu`, `popover`, `tooltip`, `alert-dialog`, `sonner`, `input-otp`,
>   `radio-group`, `collapsible`, `scroll-area`, `table`) — port these into `packages/ui` as needed
>   instead of writing from scratch
> - `src/features/dashboard/components/` (`analytics-chart.tsx`, `overview.tsx`,
>   `recent-sales.tsx`) — pattern reference for our Dashboard tab's summary cards + activity feed
> - `src/styles/theme.css` — the oklch CSS-variable theme structure (`--background`, `--primary`,
>   `--sidebar`, `--chart-1..5`, toggled via a `.dark` class) — this is exactly what gets
>   overridden for the galaxy theme below, don't reinvent the variable set

## Design System — "Mission Control" (galaxy / spaceship command theme)

Dark-first theme. The product concept already is a spaceship command deck for your
projects/agents — lean into it, but keep data still the easiest thing on screen to read; this is
a control room, not a marketing page.

- [x] Palette: override `theme.css`'s oklch variables (see reference above) with a deep-space set
      — near-black navy/indigo `--background`, violet/indigo `--card` and `--sidebar`, a cyan or
      magenta `--primary` used sparingly for active/focus states, `--chart-1..5` tuned to
      nebula-ish cyan/violet/magenta/amber rather than the default muted blues
      — ported as L-C-H triplets (not full `oklch(...)` strings) so Tailwind's `/NN` opacity
      modifiers work; `darkMode: "class"` + `<html class="dark">` forces dark-first with no toggle yet.
- [x] Status colors stay legible against the dark palette: keep `--status-up` green /
      `--status-down` red / `--status-sleeping` amber high-contrast — don't let the theme's mood
      colors compete with status meaning (`StatusDot` in `packages/ui` already isolates these)
- [x] Background treatment: subtle starfield/nebula gradient behind the app shell (CSS
      gradient/canvas, not a heavy image — keep it cheap to render and non-distracting behind text)
      — `.starfield-backdrop` in globals.css, three radial-gradients, `background-attachment: fixed`.
- [x] "Signal light" glow on live status indicators (small box-shadow glow on `StatusDot` when
      `up`, dimmed when `down`/`sleeping`) — the one place motion/glow earns its keep, since it's
      carrying real status information
- [x] Sidebar styled as a ship's nav panel: active route gets a left-edge glow bar, icons from
      `lucide-react` (already a shadcn/ui dependency)
- [x] Typography: keep body text on a normal readable sans; reserve a monospace face for
      telemetry-flavored data (timestamps, response-time ms, IDs) to sell the "console readout"
      feel without hurting readability
- [x] Respect `prefers-reduced-motion` — any glow/pulse/twinkle effects must have a static fallback
      — global media-query kill-switch in globals.css + `motion-safe:` on the signal pulse animation.
- [x] Land this as CSS-variable overrides in `apps/web/src/app/globals.css` (or a
      `packages/config` Tailwind preset addition) — never hardcode the palette inside individual
      components, so it stays swappable

## 0. Shell / shared
- [x] Sidebar + topbar layout (replace the current top-tab `NavBar`) with active-route highlighting
      — custom `AppSidebar`/`Topbar`/`AppShell` (not the full Radix-context shadcn `Sidebar`
      primitive with cookie-persisted collapse state — this app didn't need that much machinery yet).
- [x] Add shadcn/ui primitives to `packages/ui`: Table, Badge, Dialog, Dropdown, Input, Select, Form, Tabs, Toast/Sonner, Skeleton, Avatar
      — all ported except **Form**: skipped the react-hook-form-style `Form`/`FormField` wrapper in
      favor of plain controlled `Input`/`Label`/`Textarea` per form — no validation schema library
      in the project yet, so the extra abstraction wasn't earning its keep. Also added `EmptyState`
      and `Sparkline` (not in the original list, needed for task 2/dashboard).
- [x] Loading skeletons + empty states for every list view
- [x] Global toast/notification system for action feedback (wake triggered, agent created, etc.)
- [x] Auth gate (plan §10 open decision — password gate vs real auth) applied at layout level
      — resolved per user: email/password *and* Google OAuth, single allowed identity
      (`AUTH_ALLOWED_EMAIL`). Gate lives in `apps/web/src/proxy.ts` (Next 16 renamed
      `middleware.ts` → `proxy.ts`), not the layout — the correct/idiomatic place for a redirect-
      before-render check. See `apps/web/.env.example` for new vars.

## 1. Dashboard (`/`)
- [x] Summary cards: backend up/down count, frontend live count, active agent count
- [x] Recent ping activity feed (last N pings across all projects)
      — needed a new `GET /api/ping-logs` route (didn't exist; small additive read-only route,
      flagged in agent-chat.md).
- [x] Quick links into Backend/Frontend/Agents tabs

## 2. Backend Services (`/backend`)
- [x] Service list table: name, status dot, last-checked, response-time sparkline
- [x] "Wake up" button with spinner state while polling for 200
      — button reflects the mutation's pending state; the actual poll-for-200 loop is server-side
      in `wakeService` (`apps/web/src/lib/render.ts`, already built by backend).
- [x] Uptime history chart (per service, phase 2) — new `UptimeHistory` in `packages/ui`
      (status-tick timeline + response-time line chart, hand-rolled SVG like `Sparkline`, no
      charting library) wired in below the service table, one section per backend project.
- [x] Add/edit project form (Render fields: `render_service_id`, `url`, etc.)
      — both add and edit now wired: `AddProjectDialog` takes an optional `editingProject` prop
      (pre-fills, calls `PATCH /api/projects/:id` via `useUpdateProject`), triggered by a pencil
      icon per row.
- [x] Delete project — remove a backend service from the roster entirely. `DELETE
      /api/projects/:id` landed (backend, see `Tasks/agent-chat.md`); `useDeleteProject` added
      to `apps/web/src/hooks/useProjects.ts` (mirrors `useDeleteAgent`), `api.projects.remove()`
      in `apps/web/src/lib/api-client.ts`, trash-icon `ConfirmDialog` trigger next to Edit/Wake
      up on each `/backend` table row. The 409 "agent still assigned" error message is surfaced
      verbatim via the mutation's `onError` toast (same `error.message` pattern as every other
      mutation in this file — `fetchJson` already throws the API's real `error` string).
- [x] "Has `/health` endpoint" checkbox in `AddProjectDialog` (shared by both Backend Services and
      Frontend Sites, so it shows up in both add/edit forms — see `Tasks/app-backend.md` §1 for the
      new `has_health_endpoint` field it writes to), plus a warning badge next to the status dot on
      `/backend`'s table rows when a project is explicitly marked `false` (not just unset/legacy —
      don't flag rows that predate this field until the user has actually reviewed them). Purely
      informational, doesn't change ping/wake behavior — helps the user spot at a glance which
      tracked services still need a `/health` route built.
      — checked ground truth first: `has_health_endpoint?: boolean` was already on `Project`
      (`packages/types/src/project.ts`) and wired into both `POST /api/projects` and `PATCH
      /api/projects/:id` by the time I started, so this is a fully verified round-trip, not built
      against an assumed contract. No dedicated `Checkbox` primitive existed in `packages/ui` and
      `@radix-ui/react-checkbox` isn't a dependency — added a minimal `Checkbox` (plain native
      `<input type="checkbox">` styled to match `Input`'s border/focus-ring conventions, no new
      dependency) in `packages/ui/src/Checkbox.tsx`, exported from `index.ts`. `AddProjectDialog`
      defaults it to `true` for new projects, pre-fills from `editingProject?.has_health_endpoint`
      when editing, sent in both the create and update payloads. Badge on `/backend` uses `Badge
      variant="outline"` tinted with the existing `--status-sleeping` amber (no dedicated "warning"
      color token exists, reused the closest semantic one) plus a `TriangleAlert` icon, reading "No
      health API" — strict `=== false` check so unset/legacy rows aren't flagged. Didn't add the
      badge to `/frontend` (ping/health concept doesn't apply there, per the task brief's own call).
- [x] Row actions as a dropdown menu, user-requested — replace the separate pencil-edit / trash-
      delete icon buttons on each table row with a single dropdown trigger, same pattern already
      built and working on `/agents` (`apps/web/src/app/(app)/agents/page.tsx`): `MoreVertical`
      icon trigger, `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`
      from `@pcc/ui` (already exported, nothing new to build in `packages/ui`). Edit and Delete
      become `DropdownMenuItem`s inside one menu — Delete keeps going through the existing
      `ConfirmDialog` (open it from the dropdown item's `onSelect`, same as `/agents` does for its
      destructive actions — see that file for the `e.preventDefault()` + nested-dialog trick it
      already uses to stop Radix from closing the dropdown before the confirm dialog opens).
      — `ProjectActionsMenu` in `apps/web/src/app/(app)/backend/page.tsx`. Delete ports the
      `/agents` pattern exactly. Edit needed one adaptation: `AddProjectDialog` isn't a generic
      `trigger`-accepting wrapper like `ConfirmDialog` (it hardcodes its own pencil-icon button
      and isn't ref-forwarding), and per this task's scope it couldn't be touched — so
      `EditProjectMenuItem` renders `AddProjectDialog`'s real trigger button off-screen (`hidden`
      span, Dialog content still portals to `<body>` regardless) and forwards the menu item's
      click to it via `querySelector`, using the same `onSelect` `preventDefault()` trick to keep
      the dropdown mounted. See the doc comment above that function for the full reasoning.
- [x] Search bar + pagination, user-requested — a search input (filter by `project_name`/`url`)
      plus page/limit controls above the table, so it stays usable as the roster grows. See
      `Tasks/app-backend.md` §1 for the client-vs-server-side call already made on this — short
      version: do it client-side over the already-fetched list, no new API route/params needed.
      — fully client-side over the already-fetched `useProjects()` list, no new API calls/params.
      10 rows/page (`PAGE_SIZE` constant), search resets to page 1, a stale page number (e.g.
      after narrowing the result set) is clamped via a derived `currentPage = Math.min(page,
      totalPages)` computed on render rather than corrected via a `setState`-in-effect (that
      pattern is already on record as rejected by this repo's lint rule, see the `20:51` log
      entry). Distinct empty states: "No backend services yet" (full `EmptyState` + CTA, roster
      truly empty) vs. a plain "No services match search" line (roster has rows, search just
      filtered them all out). Left the Uptime History section below the table unfiltered/
      unpaginated — out of scope, the task only asked for the table.

## 3. Frontend Sites (`/frontend`)
- [x] Card grid: thumbnail, live/down badge, "Open site" link, last-deployed time
- [x] Add/edit project form (Vercel fields: `vercel_project_id`, `url`) — edit now wired the same
      way as Backend Services, pencil icon per card.
- [x] Real site thumbnails via Open Graph image, replacing the placeholder tile. `SiteCard`
      (`apps/web/src/app/(app)/frontend/page.tsx`) now renders `project.thumbnail_url` as a plain
      `<img loading="lazy">` (not `next/image` — arbitrary external domains, no fixed hostname
      allowlist is viable) inside the existing `aspect-video` tile, falling back to the `ImageOff`
      placeholder when the field is empty or the image fails to load (local `imageFailed` state
      set via `onError`). Bottom banner reworded — no more "Phase 2 — screenshot service" wording,
      now a short factual note that thumbnails come from each site's Open Graph image. No
      backfill UI for pre-existing rows built (out of scope — editing a project naturally
      re-triggers the backend fetch via `PATCH`).
- [x] Delete project — same as the Backend Services item above, for frontend-type projects.
      Trash-icon `ConfirmDialog` trigger next to Edit on each `/frontend` card.
- [x] Row actions as a dropdown menu, user-requested — same as the Backend Services item above,
      applied to each `SiteCard`'s Edit/Delete buttons (`MoreVertical` trigger, `DropdownMenu*`
      from `@pcc/ui`, same `/agents`-page pattern). New shared `SiteActionsMenu` in
      `apps/web/src/app/(app)/frontend/page.tsx`, reused by both the grid card and the new list
      row (see next item). Delete: `ConfirmDialog` via the item's `onSelect` `preventDefault()`
      trick, same as `/agents`. Edit couldn't reuse that exact trick — `AddProjectDialog` (out of
      scope this session, backend lane owns it) hardcodes its own pencil trigger with no
      custom-trigger prop like `ConfirmDialog` has — so the visible "Edit" item forwards its click
      to a real `AddProjectDialog` trigger rendered in a `hidden` wrapper via a ref + `.click()`
      instead of duplicating the edit form. See the doc comment on `SiteActionsMenu` for the full
      reasoning.
- [x] Search bar + pagination, user-requested — same as Backend Services, for the frontend site
      list (client-side, see `Tasks/app-backend.md` §1) — filters the already-fetched
      `useProjects()` list by `project_name`/`url`, 12 cards/rows per page (`PAGE_SIZE`), search
      resets to page 1, stale page numbers clamped via a derived `currentPage = Math.min(page,
      totalPages)` on render (not a `setState`-in-effect resync, same rejected pattern noted in
      the `20:51` log entry). Distinct "No frontend sites yet" vs. "No matches" empty states.
      Pagination controls only render once there's more than one page.
- [x] Grid/List view toggle, user-requested — a toggle to switch `/frontend` between the current
      card-grid layout and a compact table/list layout (mirroring `/backend`'s `Table`: name,
      status, last-deployed, actions — thumbnails just wouldn't show in list mode, that's fine).
      Persist the chosen view (localStorage is enough, no need for a backend setting) so it's
      remembered across visits. No design spec beyond "match the existing list-table styling
      already used on `/backend`" — reuse rather than inventing a third table style.
      — new `SiteListRow` reuses `@pcc/ui`'s `Table` exactly like `/backend`. Persistence via
      `useSyncExternalStore` over `localStorage` (key `pcc:frontend-view-mode`), not
      `useState`+`useEffect` — reading storage in an effect and calling `setState` synchronously
      trips this repo's `react-hooks/set-state-in-effect` lint rule; `useSyncExternalStore`'s
      `getServerSnapshot` returns `"grid"` during SSR/hydration (matching the server-rendered
      HTML, no mismatch) without a manual effect.

## 3a. SEO Analysis (`/frontend`)
Depends on `Tasks/app-backend.md` §5 (schema + `analyze-seo` route) landing first. User-requested:
score every frontend site's SEO on demand, re-runnable, visible on both the grid card/list row and
a new per-site detail page (no detail page exists for frontend sites today — only `/agents/[id]`
has this pattern).
- [ ] `api.projects.analyzeSeo(id)` in `api-client.ts` + `useAnalyzeSeo()` mutation in
      `useProjects.ts` — mirrors `useWakeProject` exactly (invalidate `PROJECTS_KEY`, success/error
      toast from `error.message`).
- [ ] `seoScoreTone(score: number | undefined)` in `lib/format.ts` — ≥90 → `"up"`, 50–89 →
      `"sleeping"`, <50 → `"down"`, `undefined` (never analyzed) → `"unknown"`. Reuses
      `StatusDotTone` semantics/color tokens, no new palette entries, same pattern as
      `projectLiveTone`/`deployReadyStateToTone` in that file.
- [ ] New `/frontend/[id]` detail page — port the exact shape of `apps/web/src/app/(app)/agents/[id]/page.tsx`:
      `useParams<{ id: string }>()`, find the project by id over the already-fetched
      `useProjects()` list (no new single-project GET route needed), back link to `/frontend`,
      loading `Skeleton`, "Project not found" `EmptyState`. Content:
        - Header card: name, url, platform badge, Edit/Delete (reuse `AddProjectDialog`/
          `ConfirmDialog`, same as `SiteActionsMenu` on the list page).
        - "Analyze SEO" `Button`, spinner while `useAnalyzeSeo`'s mutation is pending — same
          pending-state pattern as `/backend`'s "Wake up" button.
        - No `seo_last_analyzed` yet → `EmptyState` prompting to run the first scan.
        - Has one → overall score as a large tone-colored number/badge (`seoScoreTone`); segment
          breakdown as 4 labeled rows (Meta/Social/Technical/Accessibility) each with a score and a
          simple percentage bar — **no new chart dependency**, `DonutChart` is built for
          part-to-whole slices and doesn't fit a single 0–100 gauge, a plain tone-colored `<div>`
          width bar is enough; full check list grouped by segment (pass/warn/fail icon + label +
          `detail` text from `SeoCheckResult`); "Last analyzed `formatRelativeTime(seo_last_analyzed)`".
- [ ] `SiteCard` + `SiteListRow` (`apps/web/src/app/(app)/frontend/page.tsx`) — add an SEO score
      `Badge` (tone-colored via `seoScoreTone`, e.g. "SEO 82", or "Not scanned" when
      `seo_score` is unset) next to the existing platform/status badges; card and row both link
      into `/frontend/[id]` (currently neither is clickable through to a detail view at all). List
      view's `Table` gains a new "SEO" `TableHead`/`TableCell` column, positioned like `/backend`'s
      existing columns.

## 4. Agent Staff (`/agents`)
- [x] Roster grid: avatar/name/project/status
- [x] Create-agent form: project picker, local path input, brief textarea, persona/name
- [x] Fire (soft-delete → status `fired`) and hard-delete actions with confirm dialog
- [x] Per-agent detail page: brief, recent activity, "talk to this agent" → Voice Console
      — "recent activity" is an honest empty state (no agent-bridge yet, nothing to show).
- [x] Per-agent voice selection for spoken replies — new `apps/web/src/hooks/useSpeechSynthesisVoices.ts`
      (browser `SpeechSynthesisVoice[]`, lazy-`useState` initializer for the synchronous-on-mount
      read plus a `voiceschanged` subscription for the async population — see that file's docstring
      for why the initial read isn't duplicated inside the effect, `react-hooks/set-state-in-effect`
      flags that) and `apps/web/src/components/VoiceSelect.tsx` (`Select` from `@pcc/ui` populated
      from the hook, plus a speaker-icon preview button that speaks a sample sentence in the
      currently-selected voice). `CreateAgentDialog.tsx` now has an optional `VoiceSelect` field
      wired into the `POST /api/agents` payload. `AgentCard`'s dropdown (`agents/page.tsx`) gained
      a "Change voice" item using the new `apps/web/src/components/ChangeVoiceDialog.tsx` (same
      `DropdownMenuItem`-opens-a-`Dialog` composition as the existing `ConfirmDialog`-based
      Fire/Delete items), which PATCHes just `voice_uri`/`voice_name` via the new
      `useUpdateAgentVoice` hook / `api.agents.updateVoice` — see `Tasks/app-backend.md` for the
      route side.

## 5. Voice Console (`/voice`)
- [x] Agent picker
- [x] Mic capture UI (Web Speech API) + live transcript display
- [x] Reply playback (SpeechSynthesis) + text fallback log
- [x] Canned quick-command buttons ("status report", "what's blocking you", "assign a task")
      — all UI is real and functional; sending now follows the finalized queue-and-poll contract
      (`Tasks/agent-chat.md`, "Finalized contract (2026-07-17 10:00)"): `POST
      /api/agents/:id/message` returns `{ command_id, status }` immediately (queues a
      `command_queue` row rather than replying synchronously), and the page polls `GET
      /api/commands/:id` via the new `useCommandPoll` hook
      (`apps/web/src/hooks/useCommandPoll.ts`) every 3s until `status` is `"done"` (renders
      `result` as the agent's reply + speaks it) or `"failed"` (surfaced as a `system`-role log
      entry). Gives up after ~11 minutes (220 attempts) — a small buffer past the agent-bridge
      daemon's 10-minute default command timeout — with a "still running" system message rather
      than polling forever. The old "not wired up yet" banner is gone; errors (network failure,
      404/409 from the send call, failed/timeout outcomes) now surface as inline system-role log
      entries in the transcript instead of a separate persistent Card.
- [x] Markdown rendering for agent replies + per-agent voice selection — `agent`-role transcript
      entries now render through `react-markdown` (new dependency; no `rehype-raw`/raw-HTML
      plugin, since the rendered text is LLM output and stays constrained to safe markdown-only
      rendering) instead of raw text; `user`/`system` entries are untouched plain text. A small
      scoped Tailwind class (`AGENT_MARKDOWN_CLASS` in `voice/page.tsx`) substitutes for
      `@tailwindcss/typography` (not installed — Tailwind v3, this is the only use case) so
      block-level markdown (lists, code blocks, paragraphs) doesn't collapse onto itself inside
      the `rounded-lg`/`max-w-[80%]` chat bubble — preflight zeroes `p`/`ul`/`ol` margins by
      default, so this reset is load-bearing, not cosmetic. `speak()` now also takes the currently
      selected agent (looked up via `agents?.find(a => a._id === agentId)`) and, if it has a
      `voice_uri`, matches it against `window.speechSynthesis.getVoices()` and sets
      `utterance.voice` when found — falls back silently to the browser default otherwise (e.g.
      the agent's voice was configured on a different machine/browser). See §4 above for the
      `VoiceSelect`/`ChangeVoiceDialog` UI that sets `voice_uri`.

## 6. Settings (`/settings`)
- [x] Render API token field — wired to `/api/settings` (key `render_api_token`, `secret: true`).
- [x] Vercel API token field — wired to `/api/settings` (key `vercel_api_token`, `secret: true`).
- [x] Sheet-DB config display (admin sheet ID, connection status via `lsdb doctor`-style check)
      — unchanged, still static (no health-check route exists for this, out of scope here).
- [x] Screenshot service key field (phase 2) — un-disabled and wired to `/api/settings` (key
      `screenshot_service_key`) since the plumbing now exists; still labeled "Phase 2" because
      nothing consumes it yet.
      — page now uses `useSettings`/`useSaveSettings` (`apps/web/src/hooks/useSettings.ts`), Save
      enabled, "not wired up" banner removed. Each secret field shows a "Configured"/"Not set"
      badge from the GET response's `configured` flag (never the real value — backend's route
      masks secrets, see `maskSetting` in `apps/web/src/app/api/settings/route.ts`) and a blank
      Save field leaves that key unchanged (only non-empty fields are sent in the batch upsert).

## Data wiring (cuts across all tabs)
- [x] React Query (or SWR) setup for polling `/api/projects` and `/api/agents` on an interval (plan §11: 30–60s, not every render)
      — chose React Query, 45s default `refetchInterval` in `Providers.tsx`.
- [x] Wire every stub API route above once `app-backend.md` tasks land
      — projects (list/create/update/health/wake/deploy-status), agents (list/create/patch/delete),
      settings (list/save), and now agent messaging are all wired. `/api/agents/:id/message` +
      the new `GET /api/commands/:id` follow the queue-and-poll contract (see §5 above and
      `Tasks/agent-chat.md`'s 2026-07-17 log) — frontend plumbing (`api-client.ts`,
      `useCommandPoll.ts`, `/voice`) is done on this session's side; depends on the parallel
      backend session actually landing those two routes (still 501/nonexistent as of this
      commit) and the agent-bridge daemon being live for command execution to complete for real.
