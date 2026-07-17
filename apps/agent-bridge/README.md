# agent-bridge

The local daemon described in [project-control-center-plan.md](../../project-control-center-plan.md) §4.4 (Option A)
and §10, and in [Tasks/agent-bridge.md](../../Tasks/agent-bridge.md). This is Phase 4 of the build plan — **the
daemon is fully built and working**, not a scaffold: it polls `command_queue`, executes instructions with the Claude
Code CLI, and writes results back to the row. The only thing still missing to make the whole feature end-to-end is
outside this app's lane — see "What's not here" below.

## What it does

The portal (`apps/web`) is hosted on Vercel and can't reach your local filesystem or run the Claude Code CLI. This
process runs on your own machine instead:

1. **Startup health check** — confirms `ADMIN_SHEET_ID` (and the rest of the Sheets credentials) are reachable via
   `agentsTable().count()` before doing anything else. Exits non-zero immediately if that fails, rather than entering
   a poll loop that will just keep failing.
2. **Startup recovery** — any `command_queue` row still `status: "in_progress"` from a previous run (the process
   crashed or was killed mid-execution) gets requeued to `"pending"` with a note in `result` explaining why. See
   "Known limitations" below for the trade-off this implies.
3. **Poll loop**, every `pollIntervalMs` (default 10s):
   - Writes a heartbeat timestamp (see "Bridge online indicator" below).
   - Claims the oldest `pending` command belonging to an `active` agent (`claimNextPending()` in `src/queue.ts`) —
     an optimistic `update({ where: { status: "pending" } })` so two daemon instances (or a restart racing itself)
     can't both grab the same row. Commands belonging to `paused`/`fired` agents are skipped and left queued exactly
     as-is; they're picked up once/if the agent goes `active` again.
   - If a command was claimed, executes it (`executeCommand()` in `src/execute.ts`): re-checks the agent is still
     `active` (in case it was paused/fired in the gap between claim and execution — if not, releases the row back to
     `"pending"` rather than failing it), builds a prompt from the agent's `brief` + the command's `instruction`, and
     shells out to the Claude Code CLI in the agent's `local_project_path` (`runClaudeCommand()` in
     `src/claude-cli.ts`). Writes `status: "done" | "failed"` and `result` back to the row, and bumps the agent's
     `last_active`.
   - On any error (most commonly Sheets' 60-reads/min quota, plan §11), backs off geometrically (starting at
     `pollIntervalMs`, doubling up to a 60s cap) instead of hammering the API every cycle while it's failing.
4. **Graceful shutdown** — `SIGINT`/`SIGTERM` sets a flag checked at each loop boundary; an in-flight command is
   allowed to finish and write its result rather than being abandoned mid-execution. A second signal forces an
   immediate exit.

## Running it locally (foreground / dev)

```bash
pnpm --filter @pcc/agent-bridge dev     # tsx watch — restarts on source changes, for iterating on the daemon itself
pnpm --filter @pcc/agent-bridge start   # tsx, no watch — a single run, this is what day-to-day running uses
```

Both load `.env` via `tsx`'s `--env-file-if-exists` if present in `apps/agent-bridge/`.

### Env vars

Same Sheets/OAuth credentials as `packages/db/.env.example`, mirrored into this app's own `.env` (Node processes
don't share env across sibling packages — see the root `CLAUDE.md`'s Data layer section):

| Var | Required | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | Same values as `packages/db/.env` |
| `GOOGLE_REDIRECT_URI` | yes | Same value as `packages/db/.env` |
| `ADMIN_SHEET_ID` | yes | The admin Google Sheet this daemon reads/writes |
| `ADMIN_OAUTH_REFRESH_TOKEN` | yes | Same value as `packages/db/.env` |
| `AGENT_BRIDGE_POLL_INTERVAL_MS` | no | Default `10000` (10s) |
| `AGENT_BRIDGE_COMMAND_TIMEOUT_MS` | no | Default `600000` (10 min) — see "Known limitations" |
| `AGENT_BRIDGE_MAX_RESULT_LENGTH` | no | Default `40000` — see "Known limitations" |
| `AGENT_BRIDGE_CLAUDE_BIN` | no | Default `claude` — override only if the CLI isn't on `PATH` under that name |

None of the Sheets credential vars are re-validated in `src/config.ts` itself — `packages/db`'s `buildAdapter()`
already throws a clear `Missing required env var: X` error the first time a table is touched, which happens during
this daemon's own startup health check, so duplicating the check here would just be two places that can drift.

## Running it day-to-day: `launchd` (recommended)

A plain foreground terminal works for development but doesn't survive logout, sleep/wake weirdness, or a reboot —
and this daemon is only useful if it's actually running when a command shows up in the queue. Decision: use a
**`launchd` user agent** (macOS-native, ships with the OS, no extra dependency like `pm2` to install/update/babysit)
rather than a manual terminal or `pm2`. `pm2` is a reasonable alternative if you're already running it for other
processes, but for a single daemon on a single Mac, `launchd` needing nothing beyond a plist is the simplest thing
that actually works unattended.

Create `~/Library/LaunchAgents/io.suntel.pcc-agent-bridge.plist` (adjust `WorkingDirectory` and the `tsx`/node paths
to match your machine — run `which pnpm` and check your Node version manager's shim path if `node`/`pnpm` aren't at
the locations below):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.suntel.pcc-agent-bridge</string>

  <key>WorkingDirectory</key>
  <string>/Users/YOUR_USER/personal/ProjectControlCenter/apps/agent-bridge</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/pnpm</string>
    <string>start</string>
  </array>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/Users/YOUR_USER/Library/Logs/pcc-agent-bridge.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/YOUR_USER/Library/Logs/pcc-agent-bridge.err.log</string>
</dict>
</plist>
```

Then:

```bash
launchctl load ~/Library/LaunchAgents/io.suntel.pcc-agent-bridge.plist    # start now + on every login
launchctl unload ~/Library/LaunchAgents/io.suntel.pcc-agent-bridge.plist  # stop, remove from login items
tail -f ~/Library/Logs/pcc-agent-bridge.log                               # watch the JSON log lines
```

`KeepAlive: true` restarts the process if it ever exits unexpectedly (e.g. an uncaught error) — combined with the
startup recovery step above, a crash mid-command self-heals on the next launch rather than needing a manual restart.
Note this still doesn't cover the machine being asleep or powered off — see "Known limitations."

## Known limitations

- **Session continuity via `--resume`, with a stale-session fallback.** Each command runs `claude -p --resume
  <agent.claude_session_id>` (`runClaudeCommand()` in `src/claude-cli.ts`) when the agent has a stored session ID
  from a previous command, so the CLI's own conversation history — prior exploration, file reads, decisions —
  carries forward instead of every command starting from zero. `execute.ts` persists the `session_id` the CLI
  returns back onto the agent row after every command (even a task-level failure still leaves a resumable session,
  so it's persisted then too — only a launch failure or timeout with no `session_id` at all skips the write), so the
  *next* command for that agent resumes from there. If the stored ID has gone stale (session expired, deleted, or
  otherwise unknown to the CLI — confirmed live: an unresolvable `--resume` ID exits non-zero with a plain-text
  `No conversation found with session ID: ...` on stderr, no JSON at all), `runClaudeCommand()` logs a warning and
  retries once with a genuinely fresh session rather than failing the command outright. `execute.ts`'s
  `buildPrompt()` still re-supplies the agent's standing `brief` on every call regardless — cheap insurance for
  exactly this fallback case, since a freshly-started session would otherwise have no context beyond the one
  instruction. Practical effect/trade-off: an agent's session context now only grows across commands (no pruning),
  so a long-running agent's `claude -p` calls get more expensive and slower over time as the resumed conversation's
  history accumulates — there's no mechanism yet to reset or cap it short of clearing `claude_session_id` by hand.
  Each "command finished" log line now also includes `cost_usd` (the CLI's own `total_cost_usd` for that call) for
  basic cost visibility, which didn't exist before this.
- **10-minute default command timeout** (`AGENT_BRIDGE_COMMAND_TIMEOUT_MS`). A `claude -p` run that exceeds this is
  killed (`SIGTERM`) and the command is marked `failed` with whatever output was captured before the kill. A task
  that genuinely needs longer should be split into smaller instructions rather than raising this — the whole queue
  processes one command at a time (no concurrency), so a single very long-running command blocks everything behind
  it.
- **~50,000-character Sheets cell limit.** `result` is truncated at `AGENT_BRIDGE_MAX_RESULT_LENGTH` (default 40,000,
  leaving headroom under Sheets' actual ~50k cap) with a trailing note stating how many characters were cut. A very
  verbose `claude -p` response will lose its tail, not fail the write.
- **Non-idempotent retry risk on crash recovery.** `recoverStaleInProgress()` (`src/queue.ts`) requeues any row still
  `"in_progress"` at startup, on the assumption that a crash mid-command means the instruction wasn't safely
  completed — but there's no way to actually know that. If the crash happened *after* `claude` finished its work but
  *before* this process wrote the result back, the instruction will run again from scratch on the next poll. Prefer
  idempotent instructions where practical; this can't be fully solved without two-phase commit semantics the queue
  doesn't have.
- **Only works while this process is running.** Nothing in `command_queue` executes while the daemon isn't running —
  machine asleep, powered off, process killed and not yet restarted by `launchd`'s `KeepAlive`, etc. A command sent
  during that window simply sits `pending` until the daemon is back up and polls again. This is the constraint
  plan §11 and `Tasks/agent-bridge.md` §4 call out explicitly — see "Bridge online indicator" below for how a future
  UI is meant to surface it.

## Bridge online indicator (for a future UI session)

This app doesn't build any UI itself (`apps/agent-bridge` never touches `apps/web`, per the root `CLAUDE.md`'s
package boundaries) — this section documents the contract precisely enough for a future frontend/backend session to
build a "bridge online" indicator on the Agent Staff UI against it, per `Tasks/agent-bridge.md` §4.

- **Where**: the existing generic `settings` key/value table (`settingsTable()` from `@pcc/db`, no schema change
  needed — it was already built key-agnostic).
- **Key**: `agent_bridge_last_seen` (exported as `HEARTBEAT_KEY` from `src/queue.ts`, in case the constant needs to
  be referenced rather than the literal string).
- **Value**: an ISO-8601 timestamp string (`new Date().toISOString()`), `secret: false`.
- **Write frequency**: once per poll cycle, i.e. roughly every `pollIntervalMs` (default 10s) — see the top of the
  `while (!shuttingDown)` loop in `src/index.ts`.
- **How a consumer should judge staleness**: read the value via `GET /api/settings`, parse it as a timestamp, and
  compare against "now." Treat the bridge as **offline** if the timestamp is older than roughly **2–3x the poll
  interval** (so ~20–30s at the default 10s interval) — a single missed cycle shouldn't flip the indicator, but two
  or three in a row reliably means the process isn't running or is stuck. The key is simply absent (never written)
  the very first time the daemon has never run at all; a consumer should treat "missing key" the same as "offline,"
  not as an error.

## Security note

`runClaudeCommand()` uses `--permission-mode bypassPermissions`, not `--dangerously-skip-permissions` — deliberate,
since this daemon runs fully unattended and there's no one present to answer a permission prompt. Every command sent
to an `active` agent executes with full tool access in that agent's `local_project_path`, no per-tool confirmation.
That's the trade-off inherent to assigning a project to an active agent in this system: only mark an agent `active`
for a project path you're comfortable letting Claude Code operate on autonomously.

## What's not here

This daemon works standalone against `command_queue` — you can insert a row by hand (or via a throwaway script using
`commandQueueTable().create(...)`) and watch it get claimed, executed, and resolved. What's still missing for the
*whole* feature (Voice Console → agent reply) to work end-to-end is `apps/web`'s side of the queue:
`POST /api/agents/:id/message` (currently a `501` stub) needs to actually insert into `command_queue`, and a
`GET /api/commands/:id` route needs to exist for the frontend to poll for the result. That work is out of this app's
lane — see `Tasks/agent-chat.md`'s "Finalized contract (2026-07-17 10:00)" entry for the agreed shape, being built by
a separate backend/frontend session in parallel.
