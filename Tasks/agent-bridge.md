# apps/agent-bridge — Tasks (Phase 4, next priority)

The local daemon from plan §4.4 (Option A) / §10. Runs on your machine, bridges the hosted portal
to your local filesystem and Claude Code CLI. Depends only on `@pcc/db` and `@pcc/types`.

## 0. Foundations
- [x] Env/config loading (reuse `packages/db/.env.example` vars — same Sheets credentials) — `src/config.ts` + `.env.example`, mirrors `packages/db`'s vars, `envInt()` helper with sensible defaults for the bridge-specific tuning vars
- [x] Startup health check: confirm `ADMIN_SHEET_ID` reachable before entering the poll loop — `verifyStartup()` in `src/index.ts` (`agentsTable().count()`), exits non-zero on failure before the loop starts
- [x] Structured logging (timestamp, agent_id, command_id) — this runs unattended, logs are the only visibility — `src/logger.ts`, one JSON object per line, `timestamp` always present, callers pass `agent_id`/`command_id` as fields

## 1. Command queue polling
- [x] Poll loop against `commandQueueTable()` for `status: 'pending'` rows, on an interval — `while (!shuttingDown)` loop in `src/index.ts`, `AGENT_BRIDGE_POLL_INTERVAL_MS` (default 10s)
- [x] Claim a row (set `status: 'in_progress'`) before executing, to avoid double-processing on restart — `claimNextPending()` in `src/queue.ts`, optimistic `update({ where: { status: "pending" } })` guards two instances/a racing restart from both claiming the same row
- [x] Backoff/retry policy when Sheets read quota is hit (plan §11 — 60 reads/min) — geometric backoff in `src/index.ts`'s catch block, starts at `pollIntervalMs`, doubles up to a 60s cap

## 2. Execution
- [x] Resolve the target agent's `local_project_path` and `brief` via `agentsTable()` — `executeCommand()` in `src/execute.ts`
- [x] Shell out to the Claude Code CLI in that path with the instruction as the prompt — `runClaudeCommand()` in `src/claude-cli.ts`, `claude -p <prompt> --output-format json --permission-mode bypassPermissions`, `buildPrompt()` combines `agent.brief` + the instruction
- [x] Capture stdout/result, handle non-zero exit / timeout — `parseOutput()` handles the JSON `{ result, is_error }` shape with a raw-output fallback; `commandTimeoutMs` (default 10 min) kills the child and marks the result `timedOut`
- [x] Write back: `status: 'done' | 'failed'`, `result` populated on the command row — `finish()` in `src/execute.ts`, `result` truncated to `AGENT_BRIDGE_MAX_RESULT_LENGTH` (default 40k chars) ahead of Sheets' ~50k cell cap

## 3. Lifecycle / reliability
- [x] Graceful shutdown (finish or safely abandon the in-flight command on SIGINT/SIGTERM) — `requestShutdown()`/`interrupt()`/`sleep()` in `src/index.ts`; signal handlers registered before any `await` so a signal during startup still gets handled; in-flight command is allowed to finish, not abandoned
- [x] Recovery on restart: any row left `in_progress` from a previous crashed run gets requeued or flagged — `recoverStaleInProgress()` in `src/queue.ts`, requeues to `pending` with an explanatory note in `result` (documented non-idempotent-retry trade-off in the README's Known limitations)
- [x] Only ever touch agents with `status: 'active'` — skip `paused`/`fired` agents' commands — enforced twice: `claimNextPending()` skips non-active agents when scanning the pending list, and `executeCommand()` re-checks at execution time (releasing back to `pending`, not `failed`) in case the agent's status changed in the gap between claim and execution

## 4. Packaging / running it
- [x] `pnpm --filter @pcc/agent-bridge dev` for local dev (already wired via `tsx watch`)
- [x] Decide how this actually gets started day-to-day: manual `pnpm dev`, a `launchd`/systemd service, or a simple `pm2` setup — pick one and document it in the app's README — **Decision: `launchd` user agent.** macOS-native, no extra dependency, `KeepAlive` self-heals a crash (paired with the startup recovery step above). A plain foreground terminal doesn't survive logout/reboot, and `pm2` is an extra dependency to install/maintain for a single daemon on a single Mac. Full plist example + `launchctl load/unload` commands in the README's "Running it day-to-day" section.
- [x] Document the "only works while running" constraint (plan §11) somewhere the Agent Staff UI surfaces it (e.g. a bridge-online indicator) — **Decision: the heartbeat write already in `queue.ts`'s `writeHeartbeat()` (settings table, key `agent_bridge_last_seen`, ISO timestamp, written once per poll cycle) is the data source; the README's "Bridge online indicator" section documents the exact contract (key, value format, ~2-3x-poll-interval staleness rule, "missing key = offline") for whoever builds the actual UI consumer — that consumption is an `apps/web` concern, out of this app's lane per CLAUDE.md's package boundaries.**

## Open decision to settle before starting
- [x] Confirm Option A (this daemon) over Option B (deep-link to Claude Code/Cowork's own remote access) — plan §10 flags this as still open — **Confirmed with user**, see `Tasks/agent-chat.md`'s `2026-07-17 09:15` Status-table entry.

## 5. Docker Compose packaging (always-on, no remote wake) + bridge-online indicator

Prompted by the user hitting the "sent a message, nothing came back" confusion firsthand (see
`Tasks/agent-chat.md`'s `2026-07-17` entries) and asking for a way to avoid manually starting
`pnpm dev` every time. The original ask was "wake agent-bridge from the Vercel portal" — reality
check discussed and settled with the user first: Vercel is a remote, stateless service with no
path into a home network to start a stopped process/container. There's no way around needing
*something* already running locally. Given that constraint, the user chose the simpler direction:
make agent-bridge **always-on** via Docker's own restart policy (so it's simply always running
whenever the machine is on) instead of building a genuine remote-wake mechanism (tiny always-on
listener + a tunnel like Cloudflare Tunnel/Tailscale, which trades "wake on demand" for "opens an
inbound channel into your home network that has to be locked down carefully" — rejected as
unnecessary complexity/attack surface for what always-on already solves). **Explicit non-goal:**
no wake-trigger endpoint, no tunnel, no new inbound network exposure.

- [ ] **Dockerfile** for `apps/agent-bridge` — Node 20+ base image. Needs the pnpm workspace
  context (this app depends on `@pcc/db`/`@pcc/types` via `workspace:*`), so the build likely needs
  the monorepo root as build context (`docker build -f apps/agent-bridge/Dockerfile .`), copying
  the root lockfile + the three relevant packages, not just `apps/agent-bridge` in isolation.
- [ ] **Get the `claude` CLI itself into the image** — install it (npm-global install in the
  Dockerfile), pin to a version confirmed working (`2.1.211`, per the live verification in the
  session-continuity work above) rather than floating `@latest` inside a container that isn't
  rebuilt often.
- [ ] **Figure out CLI auth/session-state persistence inside the container** — the `claude` CLI
  keeps its own login/session state on disk (locally this is under the host home directory); a
  container needs that mounted as a volume so it's authenticated identically to the host install
  and so per-agent session continuity (§2 above, `claude_session_id`) actually persists across
  container restarts instead of re-authenticating or losing session state every time the container
  is recreated. Confirm the exact directory this version of the CLI uses before writing the
  compose volume mapping — don't guess.
- [ ] **`docker-compose.yml`** (repo root or `apps/agent-bridge/`) — single `agent-bridge` service,
  `restart: unless-stopped`, `env_file: apps/agent-bridge/.env` (already exists — never bake
  secrets into the image itself), volume-mount whatever host directory contains agents'
  `local_project_path`s at the *same path* inside the container (so the paths stored in the Sheet
  don't need translating/duplicating), plus the CLI auth-state volume from the previous item.
- [ ] **Auto-start at login** — configure Docker Desktop (or whatever container runtime is in use)
  to launch at login, so `restart: unless-stopped` actually has something to restart into without
  a manual `docker compose up` first. This effectively replaces the §4 `launchd`-runs-`tsx-watch`
  approach — keep that documented in the README as a lighter-weight non-Docker alternative for
  anyone who'd rather not run Docker Desktop just for this.
- [ ] **Bridge-online indicator** — **superseded by §6 below.** The user has multiple machines
  (macOS running Docker directly, Windows running Docker inside WSL2 Ubuntu), so a single global
  `agent_bridge_last_seen` flag isn't enough to answer "is *this* project's agent actually
  reachable right now" — that needs to be per-device. Don't build the single-key version; go
  straight to §6's per-device heartbeat.
- [ ] Update the README's "Running it day-to-day" section to document Docker Compose as the
  recommended always-on option, `launchd`-runs-`tsx-watch` as the lighter alternative.
- [ ] End-to-end test once built: send a Voice Console message with the container running, confirm
  it's picked up and resolves; stop the container and confirm the per-device status (§6) flips and
  stays accurate.

## 6. Multi-device support — route each command to the machine that actually has the project

The user runs agent-bridge on more than one machine (a Mac, and a Windows box via WSL2 Ubuntu +
Docker inside it) — each project's `local_project_path` only exists on one specific machine's
filesystem, so a command can't just be picked up by "whichever bridge happens to be online," it
has to land on the *right* one. The original ask was SSH/IP-based remote connect into a specific
machine; rejected in favor of extending the architecture that's already in place — agent-bridge
never needs to be reachable *from* the portal, it already reaches *out* to Google Sheets over
plain outbound HTTPS regardless of network/NAT/which machine it's on. Multi-device support is
just making that pull-based claim logic device-aware, with zero new inbound exposure.

- [ ] New `devices` table (`packages/db/schemas/admin/devices.ts`): `device_id` (required, unique
  — a UUID each daemon generates once and persists locally, e.g. `apps/agent-bridge/.device-id`,
  gitignored), `hostname`, `platform` (e.g. `darwin`, `linux` — detect WSL specifically too, since
  the user cares about telling "Mac" apart from "Windows/WSL" at a glance), `label` (optional,
  user-editable friendly name — "Mac mini", "Windows WSL"), `last_seen` (date). Register it in
  `packages/db/src/adapter.ts`'s `registerSchemas([...])` — **don't forget this step**, see the
  `2026-07-16 20:48` `Tasks/agent-chat.md` entry for how this exact omission bit a prior session
  (type-checks clean, throws `SchemaError` at runtime). Add `devicesTable()` to `src/tables.ts`,
  add `Device` to `packages/types`.
- [ ] agent-bridge: generate/persist its `device_id` once on first run; each poll cycle, upsert its
  own `devices` row (hostname/platform/`last_seen`) — this replaces the old single-key
  `writeHeartbeat()` call, not a second thing alongside it.
- [ ] `agents` table: add optional `device_id` (`.ref("devices._id")`) — which machine this agent's
  `local_project_path` lives on. Also needs a `packages/types` `Agent` update + a `PATCH
  /api/agents/:id` extension (same `"field" in body` pattern already used for `voice_uri`/
  `voice_name`) so it's assignable from the Agent Staff UI, alongside the existing project
  assignment.
- [ ] agent-bridge's `claimNextPending()` (`src/queue.ts`): only claim a command if
  `command's agent.device_id === this daemon's own device_id`. An agent with no `device_id`
  assigned yet should be treated as unclaimable (log a one-time warning so the gap is visible)
  rather than guessing which machine it belongs on.
- [ ] Portal: replace the single bridge-online badge concept with a proper **Devices** panel
  (new page, or a section under Settings) listing every known device, its hostname/platform/label,
  and online/offline computed from `last_seen` freshness (same ~2-3x-poll-interval staleness rule
  as before, just per-row now instead of one global flag). New read-only `GET /api/devices` route
  (`apps/web`) — no write route needed, the daemon writes its own row directly via `devicesTable()`,
  same pattern `ping_logs` already uses for cron-written rows with no corresponding POST route.
- [ ] Agent Staff create/edit forms: add a device-assignment dropdown (populated from `GET
  /api/devices`) next to the existing project-assignment field.

## 7. Ad hoc remote terminal (debugging access beyond queued agent tasks)

The user also wants to run arbitrary one-off commands against a specific machine from the portal
for debugging (not just dispatching Claude Code agent tasks) — e.g. checking file state, `git
status`, restarting something, tailing a log. Same rejected-SSH reasoning as §6 applies here too,
doubled: this is a *more* sensitive capability than routed agent tasks (truly arbitrary shell, not
scoped to Claude Code's own tool-call model), so it gets its own table/queue (never reuse
`command_queue` — conflating "run this Claude Code task" with "run this raw shell command" in one
ambiguous queue is a correctness and security smell) and its own, more deliberate security posture.
Split into two phases — ship 7a first, only build 7b if 7a's scrollback UX genuinely isn't enough.

### 7a. Command-based remote shell (reuses the existing poll architecture, ships first)
- [ ] New `shell_commands` table (`packages/db`): `device_id` (required, `.ref("devices._id")`),
  `command` (required, string), `status` (`pending`/`in_progress`/`done`/`failed`), `output`
  (string, truncated the same way `command_queue.result` already is ahead of Sheets' cell cap),
  `exit_code` (number).
- [ ] agent-bridge: a second, device-scoped poll loop (or folded into the existing one) claiming
  its own pending `shell_commands` rows, `spawn()`-ing the command with a timeout (mirror
  `claude-cli.ts`'s timeout/kill pattern), capturing combined stdout+stderr, writing back
  `status`/`output`/`exit_code`.
- [ ] Portal: new **Terminal** page — device picker, a command input, and a scrollback view
  (poll-based against the row's status/output, same UX shape as Voice Console's `useCommandPoll`).
  Not a real interactive PTY (no live keystrokes, no `vim`/`htop`-style TUIs, no mid-command
  Ctrl-C) — a request/response command runner with history. Good enough for the great majority of
  "what's going on over there" debugging.
- [ ] Security hardening specific to this feature, on top of the existing single-user auth gate:
  - Require an explicit device selection every time — never a "run on all devices" default.
  - Add a step-up confirmation before the Terminal page is usable per session (e.g. re-enter the
    portal password), since this is strictly more dangerous than the agent-task flow.
  - Full audit trail: every command, its output, device, and timestamp — persisted (the
    `shell_commands` rows themselves already are this), never silently discarded.
  - Explicit, persistent on-page warning that commands run with full local-user permissions on
    that specific machine.

### 7b. True interactive PTY (optional — only pursue if 7a's scrollback isn't enough)
- [ ] Re-evaluate after 7a ships. A real terminal feel (live keystrokes, `vim`/`htop`, watching a
  build stream, mid-command Ctrl-C) needs low-latency bidirectional streaming, which a Sheets-poll
  loop fundamentally can't deliver (seconds of latency, not a real shell).
- [ ] If pursued: agent-bridge opens an *outbound-only* WebSocket to a small always-on relay (can't
  be a Vercel serverless function — needs a persistent process; candidates: a small always-on
  VPS/Fly.io/Railway box) running a real shell via `node-pty`; the portal's Terminal page renders it
  with `xterm.js` over its own authenticated WebSocket to the same relay. Still zero inbound
  exposure on the actual dev machines — only outbound from agent-bridge to the relay, same
  direction-of-connection principle as everything else in this app.
- [ ] Relay auth: short-lived, per-connection tokens minted by the portal (reusing the existing
  single-user session) that bind a specific browser session to a specific `device_id`'s PTY, so
  nothing else can attach to it.
