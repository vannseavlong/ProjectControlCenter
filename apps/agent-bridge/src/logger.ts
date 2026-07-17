type LogFields = Record<string, unknown>;

/**
 * One JSON object per line on stdout/stderr — this daemon runs unattended, so logs are the only
 * visibility into what it's doing. `timestamp` is always present; callers pass `agent_id`/
 * `command_id` as fields whenever a log line relates to a specific queue row, per
 * Tasks/agent-bridge.md §0.
 */
function write(level: "info" | "warn" | "error", message: string, fields?: LogFields): void {
  const entry = { timestamp: new Date().toISOString(), level, message, ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
