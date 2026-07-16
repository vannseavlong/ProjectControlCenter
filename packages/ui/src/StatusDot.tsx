import { cn } from "./cn";

/**
 * Mirrors the status-like enums across the data model (Project.status, ping outcomes, etc.)
 * without importing @pcc/types — this component only needs the color mapping, not the schema.
 */
export type StatusDotTone = "up" | "down" | "sleeping" | "unknown";

const toneClasses: Record<StatusDotTone, string> = {
  up: "bg-status-up",
  down: "bg-status-down",
  sleeping: "bg-status-sleeping",
  unknown: "bg-status-unknown",
};

export interface StatusDotProps {
  tone: StatusDotTone;
  label?: string;
  className?: string;
}

export function StatusDot({ tone, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full", toneClasses[tone])} aria-hidden />
      {label ? <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span> : null}
    </span>
  );
}
