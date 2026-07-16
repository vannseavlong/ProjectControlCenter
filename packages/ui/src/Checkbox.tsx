import type { ComponentProps } from "react";
import { cn } from "./cn";

/**
 * Plain native `<input type="checkbox">`, not a Radix primitive — this codebase doesn't have
 * `@radix-ui/react-checkbox` as a dependency yet, and a single boolean toggle isn't worth adding
 * one for. Styled to match `Input`'s border/focus-ring conventions so it reads as part of the
 * same form system.
 */
export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded-sm border border-input bg-transparent text-primary shadow-sm outline-none transition-colors accent-primary",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
