import { cn } from "./cn";

/**
 * Mirrors the status-like enums across the data model (Project.status, ping outcomes, etc.)
 * without importing @pcc/types — this component only needs the color mapping, not the schema.
 */
export type StatusDotTone = "up" | "down" | "sleeping" | "unknown";

const toneClasses: Record<StatusDotTone, string> = {
  up: "bg-status-up signal-glow-up motion-safe:animate-signal-pulse",
  down: "bg-status-down signal-glow-down",
  sleeping: "bg-status-sleeping signal-glow-sleeping",
  unknown: "bg-status-unknown",
};

export interface StatusDotProps {
  tone: StatusDotTone;
  label?: string;
  className?: string;
}

/** Signal light: glows for `up`, dims for `down`/`sleeping` — see `.signal-glow-*` in globals.css. The pulse is `motion-safe:` gated so `prefers-reduced-motion` gets a static glow instead. */
export function StatusDot({ tone, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full", toneClasses[tone])} aria-hidden />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </span>
  );
}
