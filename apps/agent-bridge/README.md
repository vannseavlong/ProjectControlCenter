# agent-bridge

The local daemon described in [project-control-center-plan.md](../../project-control-center-plan.md) §4.4 (Option A)
and §10. This is Phase 4 of the build plan — nothing in this app runs yet.

## What this will eventually do

The portal (`apps/web`) is hosted on Vercel and can't reach your local filesystem. This process
runs on your own machine instead, and is meant to:

1. Poll the `command_queue` table (via `@pcc/db`) for `pending` instructions.
2. Execute each instruction with the Claude Code CLI, in the target agent's `local_project_path`.
3. Write the result back to the row (`status: done | failed`, `result`).

Only works while this process is actually running on your machine — see plan §11 for the
constraint this implies.

## Status

Scaffold only. `src/index.ts` is a stub — no polling loop, no Claude Code invocation, no queue
handling yet. Do not add real logic here until Phase 4.
