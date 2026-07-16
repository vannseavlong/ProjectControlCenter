# Project Control Center — Documentation & Build Plan

## 1. Vision

One portal that solves two problems at once:

1. **Uptime pain** — free-tier Render backends sleep; you want a single place to see status and wake them.
2. **Fragmented workflow** — you juggle multiple projects and want an "agent workforce" tab where you spin up a Claude agent per project, brief it on the local path and context, and talk to it by voice for status reports or quick direction.

## 2. Resource → Role Mapping

| Resource | Role in this system |
|---|---|
| Vercel | Hosts the portal itself; also the source of frontend deployment status |
| Render | Backend hosting; target of `/health` pings and wake-up calls |
| longcelot-sheet-db | The data layer — a schema-first Node.js SDK that stores your typed tables (projects, agents, ping logs, command queue) in Google Sheets via `defineTable` schemas, CRUD'd through `table.create()/findMany()/update()/delete()` |
| Google Drive | Screenshot/thumbnail storage, project docs, agent knowledge files |
| NotebookLM | Optional knowledge layer per project (source docs an agent can reference) |
| Claude Code / Cowork | The execution engine behind each "agent staff" member |

## 3. High-Level Architecture

```
Portal (Vercel, Next.js)
   ├── Sheet DB ──────────── projects, agents, ping logs, command queue
   ├── Render API ────────── /health pings, wake-up, uptime history
   ├── Vercel API ─────────── deployment status, screenshots
   └── Voice console ──────── talks to a selected agent
           │
           ▼
   Agent bridge (runs on your local machine)
           │
           ▼
   Claude Code / Cowork ──── acts inside the project's local path
```

The one non-obvious piece: the portal is hosted on Vercel, but your project files live on your local machine. Something has to bridge that gap — see section 4.4 and the open decision in section 10.

## 4. Core Modules

### 4.1 Project Registry
The shared data model everything else reads from — a `projects` table defined with lsdb's schema DSL and synced to your admin Google Sheet. One row per project, columns: `name, type (frontend/backend), platform, repo_url, render_service_id, vercel_project_id, url, thumbnail_url, status, last_checked, notes` (lsdb adds `_id`, `_created_at`, `_updated_at` automatically).

### 4.2 Health & Keep-Alive Monitor
- A cron job (Vercel Cron or a scheduled GitHub Action) hits each Render service's `/health` on an interval shorter than Render's free-tier sleep timeout (typically 15 minutes), so services never go fully idle if you want them always warm.
- A manual "Wake up" button pings once and polls until the service returns 200, showing a spinner while the cold start completes.
- Log each ping's timestamp, status, and response time so you can chart uptime.

**UI:** list of backend services, colored status dot, last-checked timestamp, "Wake up" button, small response-time sparkline.

### 4.3 Frontend Status Module
- Pull deployment status per project from the Vercel API (needs a Vercel access token stored in your settings tab).
- For thumbnails: either use a screenshot microservice (self-hosted Puppeteer on Render, or a third-party screenshot API) run on a schedule, storing images in Drive with the link cached in the sheet — or skip thumbnails initially and add them in phase 2.

**UI:** card grid — thumbnail, live/down badge, "Open site" link, last-deployed time.

### 4.4 Agent Staff Management
Each agent is a record in an `agents` table, not a running process by default. Columns: `name, assigned_project_id (ref → projects), local_project_path, brief, status (enum: active/paused/fired), last_active` (again, `_id`/`_created_at`/`_updated_at` come from lsdb).

- **Create** — form: pick project, set local path, write a brief (goals, constraints, relevant docs), pick a persona/name.
- **Fire/Delete** — "fire" sets status to `fired` (soft delete, keeps history); "delete" removes the row entirely once you're sure you don't need the record.
- **Execution** — this is the part that needs a real bridge, since the portal can't reach your filesystem on its own. Two viable approaches, detailed in section 10.

**UI:** roster grid (avatar/name/project/status), detail page per agent showing brief, recent activity, and a "talk to this agent" shortcut into the voice console.

### 4.5 Voice Command Center
- Capture speech in the browser (Web Speech API to start — free, no extra infra) and convert to text.
- Send the text plus the agent's brief and recent project state (pulled from the sheet + any linked Drive/NotebookLM docs) to the agent's backing session.
- Speak the reply back (browser `SpeechSynthesis` initially; upgrade to a nicer TTS voice like ElevenLabs later if quality matters).
- A few canned quick-commands ("give me a status report," "what's blocking you," "assign a new task") so you don't have to phrase everything from scratch.

## 5. Data Model (longcelot-sheet-db)

**Actor design:** lsdb's `actor` concept is for multi-tenant data isolation (each user gets their own sheet) — this portal is single-user, so everything lives in one `admin` actor pointed at one spreadsheet via `ADMIN_SHEET_ID`. No `user`/`seller`-style actors needed here.

```typescript
// lsdb.config.ts
export default {
  actors: [
    { name: "admin", sheetIdEnv: "ADMIN_SHEET_ID" },
  ],
};
```

```typescript
// schemas/admin/projects.ts
import { defineTable, string, number, date } from 'longcelot-sheet-db';

export default defineTable({
  name: 'projects',
  actor: 'admin',
  timestamps: true,
  columns: {
    project_name: string().required().unique(),
    type: string().enum(['frontend', 'backend']).required(),
    platform: string().enum(['vercel', 'render']).required(),
    repo_url: string(),
    render_service_id: string(),
    vercel_project_id: string(),
    url: string(),
    thumbnail_url: string(),
    status: string().enum(['up', 'down', 'sleeping', 'unknown']).default('unknown'),
    last_checked: date(),
    notes: string(),
  },
});

// schemas/admin/agents.ts
export default defineTable({
  name: 'agents',
  actor: 'admin',
  timestamps: true,
  columns: {
    agent_name: string().required(),
    assigned_project_id: string().ref('projects._id').required(),
    local_project_path: string().required(),
    brief: string(),
    status: string().enum(['active', 'paused', 'fired']).default('active'),
    last_active: date(),
  },
});

// schemas/admin/ping_logs.ts
export default defineTable({
  name: 'ping_logs',
  actor: 'admin',
  timestamps: true,
  columns: {
    project_id: string().ref('projects._id').required(),
    status: string().enum(['success', 'timeout', 'error']).required(),
    response_time_ms: number(),
  },
});

// schemas/admin/command_queue.ts — only needed for the local-bridge-daemon
// approach in 4.4; holds pending instructions per agent until the daemon picks them up
export default defineTable({
  name: 'command_queue',
  actor: 'admin',
  timestamps: true,
  columns: {
    agent_id: string().ref('agents._id').required(),
    instruction: string().required(),
    status: string().enum(['pending', 'in_progress', 'done', 'failed']).default('pending'),
    result: string(),
  },
});
```

Run `npx lsdb sync` after defining these to create the tabs in your admin sheet, and `npx lsdb erdiagram` any time you want an up-to-date ER diagram of how they relate.

## 6. UI / Tab Breakdown

1. **Dashboard** — everything at a glance: backend status, frontend status, active agents
2. **Backend Services** — Render list, wake buttons, uptime chart
3. **Frontend Sites** — Vercel grid with thumbnails
4. **Agent Staff** — roster, create/fire/delete, per-agent detail
5. **Voice Console** — pick an agent, talk to it
6. **Settings** — Render token, Vercel token, sheet-DB config, screenshot service key

## 7. Tech Stack Recommendation

- **Frontend:** Next.js + Tailwind, deployed on Vercel (matches your existing hosting)
- **API layer:** Next.js API routes for most things; a small separate Render service only if you need something long-running (e.g. a daemon or scheduled job that Vercel's serverless model doesn't suit)
- **Data:** `longcelot-sheet-db` — install as a dependency of your Next.js API routes (or a small Express service if you split the backend out), run `lsdb init`, define the schemas in section 5, `lsdb sync` to create the tabs. Requires Google OAuth credentials for the backend-to-Sheets connection (separate from any auth on the portal itself).
- **Cron:** Vercel Cron Jobs, or a scheduled GitHub Actions workflow if you want it decoupled from Vercel
- **Screenshots:** Puppeteer microservice on Render, or a third-party screenshot API if you'd rather not maintain it
- **Voice:** Web Speech API to start; ElevenLabs/Whisper as a later upgrade
- **Agent execution:** Claude Agent SDK driving Claude Code sessions, or a local bridge daemon (see section 10)

## 8. Minimum API Surface

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id/health        → pings Render /health
POST   /api/projects/:id/wake
GET    /api/agents
POST   /api/agents
PATCH  /api/agents/:id                 → pause/fire
DELETE /api/agents/:id
POST   /api/agents/:id/message         → voice/text in, agent reply out
```

## 9. Build Phases

1. **Core monitoring** — Projects sheet, Backend Services tab with health/wake, Frontend Sites grid (no thumbnails yet)
2. **Thumbnails + uptime history**
3. **Agent roster CRUD** — records only, no execution yet
4. **Agent execution** — wire up the bridge (local daemon or SDK) with text chat
5. **Voice console** — layer STT/TTS on top of phase 4

Each phase is independently useful, so you get value even if you stop after phase 2 or 3.

## 10. Open Decisions (worth settling before you build 4.4/4.5)

- **How do agents actually touch local project files?**
  - *Option A — local bridge daemon:* a small Node/Python process runs on your machine, polls the CommandQueue sheet, executes via the Claude Code CLI in the target path, writes results back. Portal stays purely a hosted control surface.
  - *Option B — deep link to Claude Code/Cowork's own remote access:* the portal doesn't reimplement execution at all — it just launches or hands off to a Claude Code/Cowork session already pointed at that project, and you interact there. Less custom code, less flexibility inside your portal's own UI.
- **Screenshot source:** self-hosted Puppeteer (more control, more upkeep) vs. a third-party screenshot API (simpler, has a cost).
- **Voice quality:** browser-only Web Speech API (free, good enough to start) vs. Whisper/ElevenLabs (better quality, adds cost and a bit of infra).
- **Auth:** this is a single-user tool holding Render/Vercel tokens — is a simple password gate sufficient, or do you want proper auth from the start? (Separate from this: lsdb itself still needs Google OAuth credentials configured purely for the backend-to-Sheets connection, regardless of how you gate the portal.)
- **Not really a decision, just worth knowing:** if this ever outgrows Sheets, lsdb ships `lsdb migrate --sql` / `createPostgresAdapter` to move to Postgres/MySQL without rewriting your CRUD calls — a non-issue for a personal tool at this scale, but nice to have if the agent roster grows into something heavier.

## 11. Constraints & Risks

- Render's free-tier sleep timeout is usually ~15 minutes of inactivity — your keep-alive interval needs to be shorter than that if you want services to never sleep.
- Google Sheets API caps reads at 60/min/user; lsdb has a built-in 2-second read cache that de-dupes repeated reads within that window, but a dashboard that polls every project's status on every render will still burn through quota fast at even a handful of projects — poll on an interval (e.g. every 30–60s) rather than on every page load.
- lsdb is explicitly built for hundreds to low-thousands of rows with ~200–700ms per operation — fine for this use case (a personal project/agent registry), but it's a staging-grade tool, not something to reach for if this ever needs to serve more than you.
- Any local-execution bridge (Option A above) only works while that daemon is actually running on your machine — worth deciding early whether that's an acceptable constraint or a dealbreaker.
