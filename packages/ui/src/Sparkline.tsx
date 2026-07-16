import { cn } from "./cn";

export interface SparklineProps {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}

/** Minimal inline-SVG sparkline — no charting library, just enough for a response-time trend in a table cell. */
export function Sparkline({ values, className, width = 64, height = 20 }: SparklineProps) {
  if (values.length < 2) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((value, i) => `${(i * step).toFixed(1)},${(height - ((value - min) / range) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("text-chart-1", className)}
      role="img"
      aria-label="Response time trend"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
