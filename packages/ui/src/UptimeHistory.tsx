import { cn } from "./cn";
import type { StatusDotTone } from "./StatusDot";

const tickToneClasses: Record<StatusDotTone, string> = {
  up: "bg-status-up",
  down: "bg-status-down",
  sleeping: "bg-status-sleeping",
  unknown: "bg-status-unknown",
};

export interface UptimeHistoryPoint {
  /** Ping outcome, already mapped to a status tone by the caller (this package doesn't know PingStatus). */
  tone: StatusDotTone;
  responseTimeMs?: number;
  /** ISO timestamp of the ping — used for tooltip text and chronological ordering (caller must pre-sort ascending). */
  timestamp: string;
}

export interface UptimeHistoryProps {
  points: UptimeHistoryPoint[];
  /** Caps how many of the most recent points are rendered, oldest-first. */
  maxPoints?: number;
  className?: string;
}

function formatTickTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/**
 * Per-service uptime history: a row of status ticks (one per ping, chronological) plus a taller
 * response-time line chart underneath. Hand-rolled inline SVG, same convention as `Sparkline` —
 * no charting library. Single series each, so no legend; native `<title>` elements give a
 * lightweight hover tooltip without extra JS state.
 */
export function UptimeHistory({ points, maxPoints = 60, className }: UptimeHistoryProps) {
  const shown = points.length > maxPoints ? points.slice(points.length - maxPoints) : points;

  if (shown.length === 0) {
    return <p className={cn("text-xs text-muted-foreground", className)}>No ping history yet.</p>;
  }

  const width = 480;
  const tickHeight = 20;
  const tickGap = 2;
  const tickWidth = Math.max((width - tickGap * (shown.length - 1)) / shown.length, 2);

  const chartHeight = 56;
  const responsePoints = shown.filter((p) => p.responseTimeMs !== undefined);
  const responseValues = responsePoints.map((p) => p.responseTimeMs as number);
  const min = responseValues.length ? Math.min(...responseValues) : 0;
  const max = responseValues.length ? Math.max(...responseValues) : 0;
  const range = max - min || 1;
  const step = shown.length > 1 ? width / (shown.length - 1) : 0;

  const linePoints = shown
    .map((p, i) =>
      p.responseTimeMs === undefined
        ? null
        : `${(i * step).toFixed(1)},${(chartHeight - ((p.responseTimeMs - min) / range) * chartHeight).toFixed(1)}`,
    )
    .filter((point): point is string => point !== null);

  return (
    <div className={cn("space-y-1.5", className)}>
      <svg
        viewBox={`0 0 ${width} ${tickHeight}`}
        width="100%"
        height={tickHeight}
        preserveAspectRatio="none"
        role="img"
        aria-label="Ping status timeline"
      >
        {shown.map((point, i) => (
          <rect
            key={i}
            x={i * (tickWidth + tickGap)}
            y={0}
            width={tickWidth}
            height={tickHeight}
            rx={1}
            className={tickToneClasses[point.tone]}
          >
            <title>
              {formatTickTime(point.timestamp)} — {point.tone}
              {point.responseTimeMs !== undefined ? ` — ${point.responseTimeMs}ms` : ""}
            </title>
          </rect>
        ))}
      </svg>

      {linePoints.length >= 2 ? (
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          width="100%"
          height={chartHeight}
          preserveAspectRatio="none"
          className="text-chart-1"
          role="img"
          aria-label="Response time over time"
        >
          <line x1={0} y1={chartHeight - 0.5} x2={width} y2={chartHeight - 0.5} className="stroke-border" strokeWidth="1" />
          <polyline
            points={linePoints.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {shown.map((point, i) =>
            point.responseTimeMs === undefined ? null : (
              <circle
                key={i}
                cx={i * step}
                cy={chartHeight - ((point.responseTimeMs - min) / range) * chartHeight}
                r={2.5}
                fill="currentColor"
              >
                <title>
                  {formatTickTime(point.timestamp)} — {point.responseTimeMs}ms
                </title>
              </circle>
            ),
          )}
        </svg>
      ) : (
        <p className="text-xs text-muted-foreground">Not enough response-time data to chart yet.</p>
      )}
    </div>
  );
}
