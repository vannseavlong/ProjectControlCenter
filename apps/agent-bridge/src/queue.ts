import { agentsTable, commandQueueTable, settingsTable } from "@pcc/db";
import type { Command } from "@pcc/types";
import { logger } from "./logger";

const HEARTBEAT_KEY = "agent_bridge_last_seen";

/**
 * Finds the oldest `pending` command whose agent is `active`, and atomically claims it (`status:
 * "in_progress"`) so a restart mid-poll never double-processes a row (Tasks/agent-bridge.md §1).
 * `paused`/`fired` agents' pending commands are skipped and left queued exactly as they are —
 * §3's "only ever touch agents with status: 'active'" rule — so this walks the pending list
 * oldest-first looking for the first one backed by an active agent, rather than just taking the
 * head of the queue.
 */
export async function claimNextPending(): Promise<Command | null> {
  const pending = await commandQueueTable().findMany({
    where: { status: "pending" },
    orderBy: "_created_at",
    order: "asc",
  });

  for (const command of pending) {
    const agent = await agentsTable().findOne({ where: { _id: command.agent_id } });
    if (!agent) {
      logger.warn("pending command references a missing agent, skipping", {
        agent_id: command.agent_id,
        command_id: command._id,
      });
      continue;
    }
    if (agent.status !== "active") {
      continue;
    }

    // Optimistic claim: only succeeds if the row is still "pending" at the moment of the write —
    // guards against two daemon instances (or a restart racing itself) both picking the same row.
    const claimed = await commandQueueTable().update({
      where: { _id: command._id, status: "pending" },
      data: { status: "in_progress" },
    });
    if (claimed !== 1) {
      continue;
    }

    return { ...command, status: "in_progress" };
  }

  return null;
}

/**
 * Startup recovery (Tasks/agent-bridge.md §3): any row still `in_progress` from a previous run
 * means the daemon crashed or was killed mid-execution — we can't know whether `claude -p`
 * actually finished, so the chosen behavior is to requeue it (`status: "pending"`) rather than
 * flag it `failed`, since a crash is an infrastructure problem, not a genuine task failure, and
 * requeueing means the instruction still gets attempted rather than silently dropped. The
 * `result` field gets a note explaining why it's back in the queue, so the history isn't lost —
 * the trade-off documented in the README is that a non-idempotent instruction could run twice if
 * the crash happened after `claude` actually finished its work but before this process wrote the
 * result back.
 */
export async function recoverStaleInProgress(): Promise<number> {
  const stale = await commandQueueTable().findMany({ where: { status: "in_progress" } });
  for (const command of stale) {
    await commandQueueTable().update({
      where: { _id: command._id },
      data: {
        status: "pending",
        result: `[agent-bridge] Requeued at ${new Date().toISOString()} — was still "in_progress" when the daemon started, meaning the previous run crashed or was killed mid-execution. Re-running from scratch; if the instruction wasn't idempotent it may partially repeat.`,
      },
    });
    logger.warn("requeued stale in_progress command from a previous run", {
      agent_id: command.agent_id,
      command_id: command._id,
    });
  }
  return stale.length;
}

/**
 * Writes a timestamp to the existing generic `settings` key/value table (no schema change needed
 * — `settingsTable()` was already built key-agnostic, see Tasks/agent-chat.md's 2026-07-16 20:48
 * entry) so a future frontend/backend session can surface a "bridge online" indicator on the
 * Agent Staff UI by reading `GET /api/settings` and checking whether this key's value is recent.
 * Documented as the concrete mechanism in Tasks/agent-bridge.md §4 rather than left as a vague
 * TODO — see this app's README for the exact contract a UI session would need.
 */
export async function writeHeartbeat(): Promise<void> {
  await settingsTable().upsert({
    where: { key: HEARTBEAT_KEY },
    data: { key: HEARTBEAT_KEY, value: new Date().toISOString(), secret: false },
  });
}

export { HEARTBEAT_KEY };
