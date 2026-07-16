export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatResponseTime(ms: number | undefined): string {
  if (ms === undefined) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Maps a ping outcome (`PingLog.status`) to a `StatusDotTone` for components in `@pcc/ui`
 * — that package deliberately doesn't import `@pcc/types`, so this translation lives here.
 * `timeout` maps to `sleeping` (amber) rather than `down` (red): a timeout on a Render free-tier
 * service usually means it's asleep and waking up, not actually failing.
 */
export function pingStatusToTone(status: "success" | "timeout" | "error"): "up" | "down" | "sleeping" {
  switch (status) {
    case "success":
      return "up";
    case "timeout":
      return "sleeping";
    case "error":
      return "down";
  }
}
