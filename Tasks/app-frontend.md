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

- [ ] Palette: override `theme.css`'s oklch variables (see reference above) with a deep-space set
      — near-black navy/indigo `--background`, violet/indigo `--card` and `--sidebar`, a cyan or
      magenta `--primary` used sparingly for active/focus states, `--chart-1..5` tuned to
      nebula-ish cyan/violet/magenta/amber rather than the default muted blues
- [ ] Status colors stay legible against the dark palette: keep `--status-up` green /
      `--status-down` red / `--status-sleeping` amber high-contrast — don't let the theme's mood
      colors compete with status meaning (`StatusDot` in `packages/ui` already isolates these)
- [ ] Background treatment: subtle starfield/nebula gradient behind the app shell (CSS
      gradient/canvas, not a heavy image — keep it cheap to render and non-distracting behind text)
- [ ] "Signal light" glow on live status indicators (small box-shadow glow on `StatusDot` when
      `up`, dimmed when `down`/`sleeping`) — the one place motion/glow earns its keep, since it's
      carrying real status information
- [ ] Sidebar styled as a ship's nav panel: active route gets a left-edge glow bar, icons from
      `lucide-react` (already a shadcn/ui dependency)
- [ ] Typography: keep body text on a normal readable sans; reserve a monospace face for
      telemetry-flavored data (timestamps, response-time ms, IDs) to sell the "console readout"
      feel without hurting readability
- [ ] Respect `prefers-reduced-motion` — any glow/pulse/twinkle effects must have a static fallback
- [ ] Land this as CSS-variable overrides in `apps/web/src/app/globals.css` (or a
      `packages/config` Tailwind preset addition) — never hardcode the palette inside individual
      components, so it stays swappable

## 0. Shell / shared
- [ ] Sidebar + topbar layout (replace the current top-tab `NavBar`) with active-route highlighting
- [ ] Add shadcn/ui primitives to `packages/ui`: Table, Badge, Dialog, Dropdown, Input, Select, Form, Tabs, Toast/Sonner, Skeleton, Avatar
- [ ] Loading skeletons + empty states for every list view
- [ ] Global toast/notification system for action feedback (wake triggered, agent created, etc.)
- [ ] Auth gate (plan §10 open decision — password gate vs real auth) applied at layout level

## 1. Dashboard (`/`)
- [ ] Summary cards: backend up/down count, frontend live count, active agent count
- [ ] Recent ping activity feed (last N pings across all projects)
- [ ] Quick links into Backend/Frontend/Agents tabs

## 2. Backend Services (`/backend`)
- [ ] Service list table: name, status dot, last-checked, response-time sparkline
- [ ] "Wake up" button with spinner state while polling for 200
- [ ] Uptime history chart (per service, phase 2)
- [ ] Add/edit project form (Render fields: `render_service_id`, `url`, etc.)

## 3. Frontend Sites (`/frontend`)
- [ ] Card grid: thumbnail, live/down badge, "Open site" link, last-deployed time
- [ ] Add/edit project form (Vercel fields: `vercel_project_id`, `url`)
- [ ] Thumbnail placeholder state until phase 2 screenshot service lands

## 4. Agent Staff (`/agents`)
- [ ] Roster grid: avatar/name/project/status
- [ ] Create-agent form: project picker, local path input, brief textarea, persona/name
- [ ] Fire (soft-delete → status `fired`) and hard-delete actions with confirm dialog
- [ ] Per-agent detail page: brief, recent activity, "talk to this agent" → Voice Console

## 5. Voice Console (`/voice`)
- [ ] Agent picker
- [ ] Mic capture UI (Web Speech API) + live transcript display
- [ ] Reply playback (SpeechSynthesis) + text fallback log
- [ ] Canned quick-command buttons ("status report", "what's blocking you", "assign a task")

## 6. Settings (`/settings`)
- [ ] Render API token field
- [ ] Vercel API token field
- [ ] Sheet-DB config display (admin sheet ID, connection status via `lsdb doctor`-style check)
- [ ] Screenshot service key field (phase 2)

## Data wiring (cuts across all tabs)
- [ ] React Query (or SWR) setup for polling `/api/projects` and `/api/agents` on an interval (plan §11: 30–60s, not every render)
- [ ] Wire every stub API route above once `app-backend.md` tasks land
