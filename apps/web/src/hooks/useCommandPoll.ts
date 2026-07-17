"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Command } from "@pcc/types";
import { api } from "@/lib/api-client";

/**
 * How often to check `GET /api/commands/:id` while a command is still `pending`/`in_progress`.
 * 3s feels responsive without hammering the API for something that can legitimately take minutes.
 */
const POLL_INTERVAL_MS = 3_000;

/**
 * Give up after ~11 minutes of polling (220 attempts * 3s) — a small buffer past the
 * agent-bridge daemon's 10-minute default command timeout (`AGENT_BRIDGE_COMMAND_TIMEOUT_MS`), so
 * a command that legitimately times out server-side and gets marked "failed" is still caught by
 * this window before the UI gives up on its own. Past that point something's stuck queue-side
 * (daemon not running, etc.) and polling forever would just spin silently — better to hand
 * control back to the user with a clear "still running" message than never resolve.
 */
const MAX_POLL_ATTEMPTS = 220;

export type CommandOutcome =
  | { kind: "done"; command: Command }
  | { kind: "failed"; command: Command }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

/**
 * Polls `GET /api/commands/:id` on an interval until it reaches a terminal status (`done` /
 * `failed`), the give-up cutoff is hit, or a request errors out. Only one poll runs at a time —
 * starting a new one (or unmounting) clears any interval already in flight, so callers don't need
 * to manage cleanup themselves.
 */
export function useCommandPoll() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancel = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Belt-and-suspenders: also clear on unmount so a poll never outlives its component.
  useEffect(() => cancel, [cancel]);

  const poll = useCallback(
    (commandId: string) =>
      new Promise<CommandOutcome>((resolve) => {
        cancel();
        let attempts = 0;
        intervalRef.current = setInterval(() => {
          attempts += 1;
          api.commands
            .get(commandId)
            .then(({ command }) => {
              if (command.status === "done") {
                cancel();
                resolve({ kind: "done", command });
              } else if (command.status === "failed") {
                cancel();
                resolve({ kind: "failed", command });
              } else if (attempts >= MAX_POLL_ATTEMPTS) {
                cancel();
                resolve({ kind: "timeout" });
              }
              // else: still "pending"/"in_progress" — keep polling
            })
            .catch((error: unknown) => {
              cancel();
              resolve({ kind: "error", message: error instanceof Error ? error.message : "Failed to check command status" });
            });
        }, POLL_INTERVAL_MS);
      }),
    [cancel],
  );

  return { poll, cancel };
}
