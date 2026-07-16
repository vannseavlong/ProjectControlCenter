import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
