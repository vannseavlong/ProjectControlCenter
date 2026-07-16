"use client";

import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "./cn";

export interface AreaTrendPoint {
  label: string;
  value: number;
}

export interface AreaTrendChartProps {
  points: AreaTrendPoint[];
  className?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}

const VIEW_WIDTH = 600;

/** Rounds a domain max up to a "clean" step so y-axis ticks read as whole numbers, not fractions. */
function niceStep(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 0.2 : normalized <= 2 ? 0.5 : normalized <= 5 ? 1 : 2;
  return step * magnitude;
}

/** Coordinates are indexed within loop bounds throughout — `!` asserts what the bounds already guarantee. */
function catmullRomPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return "";
  const first = coords[0]!;
  if (coords.length === 1) return `M ${first.x},${first.y}`;
  if (coords.length === 2) {
    const second = coords[1]!;
    return `M ${first.x},${first.y} L ${second.x},${second.y}`;
  }

  let d = `M ${first.x},${first.y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p0 = coords[i - 1] ?? p1;
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * Single-series curve/area chart — response-time-over-time style data. Hand-rolled inline SVG,
 * same no-dependency convention as `Sparkline`/`UptimeHistory`, but bigger: gridlines, y-axis
 * ticks, a hover crosshair + tooltip, and a direct end-label on the last point. One series, so
 * no legend box (the card title names it) per the dataviz mark spec.
 */
export function AreaTrendChart({
  points,
  className,
  height = 160,
  valueFormatter = (v) => String(v),
  emptyMessage = "Not enough data yet.",
}: AreaTrendChartProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { linePath, areaPath, coords, ticks, domainMax, plotHeight } = useMemo(() => {
    const plotH = height;
    if (points.length === 0) {
      return {
        linePath: "",
        areaPath: "",
        coords: [] as { x: number; y: number }[],
        ticks: [] as number[],
        domainMax: 1,
        plotHeight: plotH,
      };
    }

    const values = points.map((p) => p.value);
    const max = Math.max(...values, 0);
    const step = niceStep(max || 1);
    const niceMax = Math.ceil((max || 1) / step) * step || step;
    const range = niceMax || 1;

    const xStep = points.length > 1 ? VIEW_WIDTH / (points.length - 1) : 0;
    const coordinates = points.map((p, i) => ({
      x: points.length > 1 ? i * xStep : VIEW_WIDTH / 2,
      y: plotH - (p.value / range) * plotH,
    }));

    const line = catmullRomPath(coordinates);
    const lastCoordinate = coordinates[coordinates.length - 1]!;
    const firstCoordinate = coordinates[0]!;
    const area = `${line} L ${lastCoordinate.x},${plotH} L ${firstCoordinate.x},${plotH} Z`;

    const tickCount = 4;
    const tickValues = Array.from({ length: tickCount + 1 }, (_, i) => (range * i) / tickCount);

    return { linePath: line, areaPath: area, coords: coordinates, ticks: tickValues, domainMax: range, plotHeight: plotH };
  }, [points, height]);

  if (points.length < 2) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{emptyMessage}</p>;
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.min(Math.max(index, 0), points.length - 1));
  };

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : undefined;
  const hoveredCoord = hoverIndex !== null ? coords[hoverIndex] : undefined;
  const hovered = hoveredPoint && hoveredCoord ? { point: hoveredPoint, coord: hoveredCoord } : null;
  // `points.length >= 2` is guaranteed by the early return above, so these are always in bounds.
  const lastCoord = coords[coords.length - 1]!;
  const lastPoint = points[points.length - 1]!;
  const firstPoint = points[0]!;
  const midPoint = points.length > 2 ? points[Math.floor((points.length - 1) / 2)] : undefined;
  const tooltipPct = hovered ? (hovered.coord.x / VIEW_WIDTH) * 100 : 0;

  return (
    <div className={cn("select-none", className)}>
      <div className="flex gap-2">
        <div
          className="flex shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground"
          style={{ height: plotHeight }}
        >
          {ticks
            .slice()
            .reverse()
            .map((tick, i) => (
              <span key={i}>{valueFormatter(Math.round(tick))}</span>
            ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${plotHeight}`}
            width="100%"
            height={plotHeight}
            preserveAspectRatio="none"
            className="overflow-visible text-chart-1"
            role="img"
            aria-label="Trend over time"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((tick, i) => {
              const y = plotHeight - (tick / domainMax) * plotHeight;
              return <line key={i} x1={0} y1={y} x2={VIEW_WIDTH} y2={y} className="stroke-border" strokeWidth={1} />;
            })}

            <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
            <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            <circle cx={lastCoord.x} cy={lastCoord.y} r={4} fill="currentColor" className="stroke-card" strokeWidth={2} />

            {hovered ? (
              <>
                <line
                  x1={hovered.coord.x}
                  y1={0}
                  x2={hovered.coord.x}
                  y2={plotHeight}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <circle
                  cx={hovered.coord.x}
                  cy={hovered.coord.y}
                  r={4}
                  fill="currentColor"
                  className="stroke-card"
                  strokeWidth={2}
                />
              </>
            ) : null}

            <rect
              x={0}
              y={0}
              width={VIEW_WIDTH}
              height={plotHeight}
              fill="transparent"
              style={{ pointerEvents: "all", cursor: "crosshair" }}
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            />
          </svg>

          <span
            className="pointer-events-none absolute text-[10px] font-medium text-foreground"
            style={{
              left: `${Math.min((lastCoord.x / VIEW_WIDTH) * 100, 92)}%`,
              top: Math.max(lastCoord.y - 18, 0),
            }}
          >
            {valueFormatter(lastPoint.value)}
          </span>

          {hovered ? (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md"
              style={{
                left: `${tooltipPct}%`,
                transform: `translate(${tooltipPct < 15 ? "0%" : tooltipPct > 85 ? "-100%" : "-50%"}, calc(-100% - 8px))`,
              }}
            >
              <p className="font-mono font-semibold text-foreground">{valueFormatter(hovered.point.value)}</p>
              <p className="text-muted-foreground">{hovered.point.label}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between pl-9 font-mono text-[10px] text-muted-foreground">
        <span>{firstPoint.label}</span>
        {midPoint ? <span>{midPoint.label}</span> : null}
        <span>{lastPoint.label}</span>
      </div>
    </div>
  );
}
