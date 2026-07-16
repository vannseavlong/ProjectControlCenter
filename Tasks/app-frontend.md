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

## 3. Frontend Sites (`/frontend`)
- [x] Card grid: thumbnail, live/down badge, "Open site" link, last-deployed time
- [x] Add/edit project form (Vercel fields: `vercel_project_id`, `url`) — edit now wired the same
      way as Backend Services, pencil icon per card.
- [x] Thumbnail placeholder state until phase 2 screenshot service lands

## 4. Agent Staff (`/agents`)
- [x] Roster grid: avatar/name/project/status
- [x] Create-agent form: project picker, local path input, brief textarea, persona/name
- [x] Fire (soft-delete → status `fired`) and hard-delete actions with confirm dialog
- [x] Per-agent detail page: brief, recent activity, "talk to this agent" → Voice Console
      — "recent activity" is an honest empty state (no agent-bridge yet, nothing to show).

## 5. Voice Console (`/voice`)
- [x] Agent picker
- [x] Mic capture UI (Web Speech API) + live transcript display
- [x] Reply playback (SpeechSynthesis) + text fallback log
- [x] Canned quick-command buttons ("status report", "what's blocking you", "assign a task")
      — all UI is real and functional; actually sending still hits the `POST
      /api/agents/:id/message` 501 stub (blocked on agent-bridge per backend's note) — the page
      shows an explicit "not wired up yet" banner rather than pretending it works.

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
      and settings (list/save) are all real and wired. Still open: `/api/agents/:id/message` (501,
      blocked on agent-bridge — the only remaining stub).
