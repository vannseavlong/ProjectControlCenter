"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Dark-first app — no light/dark toggle wired yet, so the toaster theme is pinned to match `<html class="dark">`. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "oklch(var(--popover))",
          "--normal-text": "oklch(var(--popover-foreground))",
          "--normal-border": "oklch(var(--border))",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { toast } from "sonner";
