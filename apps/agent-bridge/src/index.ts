import { agentsTable } from "@pcc/db";
import { config } from "./config";
import { executeCommand } from "./execute";
import { logger } from "./logger";
import { claimNextPending, recoverStaleInProgress, writeHeartbeat } from "./queue";

let wake: (() => void) | null = null;
let shuttingDown = false;

/**
 * Sleeps for `ms`, but resolves immediately if `interrupt()` is called while sleeping — used so
 * a SIGINT/SIGTERM during the idle poll wait doesn't leave the daemon hanging for up to a full
 * `pollIntervalMs` before it notices the shutdown request and exits.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wake = null;
      resolve();
    }, ms);
    wake = () => {
      clearTimeout(timer);
      wake = null;
      resolve();
    };
  });
}

function interrupt(): void {
  wake?.();
}

/**
 * Confirms `ADMIN_SHEET_ID` (and the rest of the Sheets credentials) actually work before
 * entering the poll loop, per Tasks/agent-bridge.md §0. Deliberately just exercises the real
 * adapter (`agentsTable().count()`) rather than re-validating env vars by hand — `packages/db`'s
 * `buildAdapter()` already throws a clear `Missing required env var: X` error for any missing
 * credential the first time a table is touched, so this call surfaces both "env var missing" and
 * "credentials present but Sheets rejected them" with the same code path.
 */
async function verifyStartup(): Promise<void> {
  const agentCount = await agentsTable().count();
  logger.info("startup health check passed", { admin_sheet_reachable: true, agent_count: agentCount });
}

function requestShutdown(signal: string): void {
  if (shuttingDown) {
    logger.warn("second shutdown signal received, exiting immediately", { signal });
    process.exit(1);
  }
  shuttingDown = true;
  logger.info("shutdown requested — will finish the in-flight command (if any) and stop, not abandon it", { signal });
  interrupt();
}

async function main(): Promise<void> {
  // Registered before any `await` — a signal arriving during verifyStartup()/
  // recoverStaleInProgress() (e.g. a slow first OAuth token refresh) must still hit this handler
  // instead of Node's default terminate-immediately behavior, which would skip the "shutdown
  // requested" log and any chance of exiting cleanly. Confirmed this mattered by testing: an
  // earlier version registered these after startup and a SIGTERM during that window silently
  // hard-killed the process instead of logging anything.
  process.on("SIGINT", () => requestShutdown("SIGINT"));
  process.on("SIGTERM", () => requestShutdown("SIGTERM"));

  logger.info("agent-bridge starting", {
    poll_interval_ms: config.pollIntervalMs,
    command_timeout_ms: config.commandTimeoutMs,
  });

  try {
    await verifyStartup();
  } catch (err) {
    logger.error("startup health check failed — cannot reach ADMIN_SHEET_ID, exiting", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  if (shuttingDown) {
    logger.info("shutdown requested during startup, exiting without entering the poll loop");
    process.exit(0);
  }

  const requeued = await recoverStaleInProgress();
  if (requeued > 0) {
    logger.warn("recovered stale in_progress command(s) left over from a previous run", { count: requeued });
  }

  if (shuttingDown) {
    logger.info("shutdown requested during startup recovery, exiting without entering the poll loop");
    process.exit(0);
  }

  let backoffMs = config.pollIntervalMs;
  const maxBackoffMs = 60_000;

  while (!shuttingDown) {
    try {
      await writeHeartbeat();
      const claimed = await claimNextPending();

      if (claimed) {
        await executeCommand(claimed);
        backoffMs = config.pollIntervalMs;
        continue;
      }

      backoffMs = config.pollIntervalMs;
      // Guards a race with requestShutdown(): if the signal arrived while writeHeartbeat()/
      // claimNextPending() were still in flight, `interrupt()` already fired-and-missed (sleep()
      // hadn't been called yet, so `wake` was still null) — without this check we'd start a
      // fresh, un-interrupted full-length sleep right after shuttingDown flipped to true.
      if (!shuttingDown) {
        await sleep(config.pollIntervalMs);
      }
    } catch (err) {
      // Covers Sheets' 60-reads/min quota (plan §11) and any other transient adapter error —
      // lsdb's own 2s read cache already absorbs short bursts, so this is just a fallback for
      // when that isn't enough: back off geometrically instead of hammering the API every
      // pollIntervalMs while it's still failing.
      logger.error("poll loop error, backing off", {
        error: err instanceof Error ? err.message : String(err),
        backoff_ms: backoffMs,
      });
      if (!shuttingDown) {
        await sleep(backoffMs);
      }
      backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
    }
  }

  logger.info("shutdown complete");
  process.exit(0);
}

main().catch((err) => {
  logger.error("fatal error, exiting", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
