"use client";

import { useState } from "react";
import { cn } from "./cn";
import type { StatusDotTone } from "./StatusDot";

const toneStrokeClasses: Record<StatusDotTone, string> = {
  up: "stroke-status-up",
  down: "stroke-status-down",
  sleeping: "stroke-status-sleeping",
  unknown: "stroke-status-unknown",
};

const toneSwatchClasses: Record<StatusDotTone, string> = {
  up: "bg-status-up",
  down: "bg-status-down",
  sleeping: "bg-status-sleeping",
  unknown: "bg-status-unknown",
};

export interface DonutChartSlice {
  key: string;
  label: string;
  value: number;
  tone: StatusDotTone;
}

export interface DonutChartProps {
  slices: DonutChartSlice[];
  className?: string;
  size?: number;
  centerLabel?: string;
  emptyMessage?: string;
}

const STROKE_WIDTH = 20;
const GAP_DEGREES = 3;

/**
 * Part-to-whole donut for a small, exclusive status breakdown (≤4 slices) — e.g. project
 * up/down/sleeping/unknown counts. Uses the app's reserved status tokens, not the categorical
 * chart palette, since these slices *mean* good/bad rather than "series N". Per-slice hover
 * tooltip + an always-present legend (never color-only identity), same no-dependency inline-SVG
 * convention as the rest of `@pcc/ui`.
 */
export function DonutChart({ slices, className, size = 160, centerLabel, emptyMessage = "No data yet." }: DonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const nonZero = slices.filter((s) => s.value > 0);
  const total = nonZero.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{emptyMessage}</p>;
  }

  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const gapLength = (GAP_DEGREES / 360) * circumference;

  const arcs = nonZero.reduce<{ slice: DonutChartSlice; visibleLength: number; offset: number; percent: number }[]>(
    (acc, slice) => {
      const cumulative = acc.reduce((sum, a) => sum + a.visibleLength + gapLength, 0);
      const fraction = slice.value / total;
      const arcLength = fraction * circumference;
      const visibleLength = Math.max(arcLength - gapLength, 0);
      const offset = -cumulative - gapLength / 2;
      acc.push({ slice, visibleLength, offset, percent: Math.round(fraction * 100) });
      return acc;
    },
    [],
  );

  const hovered = arcs.find((a) => a.slice.key === hoveredKey);

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Status breakdown">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-border" strokeWidth={STROKE_WIDTH} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {arcs.map(({ slice, visibleLength, offset, percent }) => (
              <circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                className={cn(toneStrokeClasses[slice.tone], "transition-opacity")}
                strokeWidth={hoveredKey && hoveredKey !== slice.key ? STROKE_WIDTH - 4 : STROKE_WIDTH}
                strokeOpacity={hoveredKey && hoveredKey !== slice.key ? 0.45 : 1}
                strokeDasharray={`${visibleLength} ${circumference - visibleLength}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                style={{ cursor: "pointer" }}
                onPointerEnter={() => setHoveredKey(slice.key)}
                onPointerLeave={() => setHoveredKey((k) => (k === slice.key ? null : k))}
              >
                <title>
                  {slice.label}: {slice.value} ({percent}%)
                </title>
              </circle>
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">{hovered ? hovered.slice.value : total}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {hovered ? hovered.slice.label : (centerLabel ?? "Total")}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {nonZero.map((slice) => {
          const percent = Math.round((slice.value / total) * 100);
          return (
            <li
              key={slice.key}
              className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 hover:bg-accent/40"
              onPointerEnter={() => setHoveredKey(slice.key)}
              onPointerLeave={() => setHoveredKey((k) => (k === slice.key ? null : k))}
            >
              <span className="flex items-center gap-2 truncate text-muted-foreground">
                <span className={cn("size-2.5 shrink-0 rounded-full", toneSwatchClasses[slice.tone])} aria-hidden />
                {slice.label}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
                {slice.value} · {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
