# apps/agent-bridge — Tasks (Phase 4, next priority)

The local daemon from plan §4.4 (Option A) / §10. Runs on your machine, bridges the hosted portal
to your local filesystem and Claude Code CLI. Depends only on `@pcc/db` and `@pcc/types`.

## 0. Foundations
- [ ] Env/config loading (reuse `packages/db/.env.example` vars — same Sheets credentials)
- [ ] Startup health check: confirm `ADMIN_SHEET_ID` reachable before entering the poll loop
- [ ] Structured logging (timestamp, agent_id, command_id) — this runs unattended, logs are the only visibility

## 1. Command queue polling
- [ ] Poll loop against `commandQueueTable()` for `status: 'pending'` rows, on an interval
- [ ] Claim a row (set `status: 'in_progress'`) before executing, to avoid double-processing on restart
- [ ] Backoff/retry policy when Sheets read quota is hit (plan §11 — 60 reads/min)

## 2. Execution
- [ ] Resolve the target agent's `local_project_path` and `brief` via `agentsTable()`
- [ ] Shell out to the Claude Code CLI in that path with the instruction as the prompt
- [ ] Capture stdout/result, handle non-zero exit / timeout
- [ ] Write back: `status: 'done' | 'failed'`, `result` populated on the command row

## 3. Lifecycle / reliability
- [ ] Graceful shutdown (finish or safely abandon the in-flight command on SIGINT/SIGTERM)
- [ ] Recovery on restart: any row left `in_progress` from a previous crashed run gets requeued or flagged
- [ ] Only ever touch agents with `status: 'active'` — skip `paused`/`fired` agents' commands

## 4. Packaging / running it
- [ ] `pnpm --filter @pcc/agent-bridge dev` for local dev (already wired via `tsx watch`)
- [ ] Decide how this actually gets started day-to-day: manual `pnpm dev`, a `launchd`/systemd service, or a simple `pm2` setup — pick one and document it in the app's README
- [ ] Document the "only works while running" constraint (plan §11) somewhere the Agent Staff UI surfaces it (e.g. a bridge-online indicator)

## Open decision to settle before starting
- [ ] Confirm Option A (this daemon) over Option B (deep-link to Claude Code/Cowork's own remote access) — plan §10 flags this as still open
