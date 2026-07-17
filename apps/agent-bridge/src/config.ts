function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Sheets credential env vars (ADMIN_SHEET_ID, GOOGLE_CLIENT_ID/SECRET, GOOGLE_REDIRECT_URI,
 * ADMIN_OAUTH_REFRESH_TOKEN) are intentionally NOT re-validated here — packages/db's
 * `buildAdapter()` (src/adapter.ts) already `requireEnv`s them the first time any table helper
 * touches the sheet, which happens during this daemon's own startup health check
 * (see src/index.ts). Duplicating that check here would just be two places that can drift.
 */
export const config = {
  /** How often to poll command_queue for pending rows. Sheets caps reads at 60/min/user (plan
   * §11); lsdb's built-in 2s read cache absorbs bursts, so this just needs to stay comfortably
   * below that quota on its own — 10s gives ~6 poll cycles/min, well under the limit even with
   * the heartbeat write folded into the same cycle. */
  pollIntervalMs: envInt("AGENT_BRIDGE_POLL_INTERVAL_MS", 10_000),
  /** Max wall-clock time to let one `claude -p` invocation run before it's killed and the command
   * is marked failed. 10 minutes is generous for a single instruction; a real task that needs
   * longer should probably be split up. */
  commandTimeoutMs: envInt("AGENT_BRIDGE_COMMAND_TIMEOUT_MS", 10 * 60_000),
  /** Google Sheets cells cap out around 50,000 characters — truncate whatever `claude -p` returns
   * before writing it to `command_queue.result` so a chatty run can't fail the write entirely. */
  maxResultLength: envInt("AGENT_BRIDGE_MAX_RESULT_LENGTH", 40_000),
  /** Override only if `claude` isn't on PATH under its usual name — not expected day-to-day. */
  claudeBin: process.env.AGENT_BRIDGE_CLAUDE_BIN ?? "claude",
};
