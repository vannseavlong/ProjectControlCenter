"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@pcc/ui";
import { NAV_ITEMS } from "./nav-items";

function currentTitle(pathname: string): string {
  const match = NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Project Control Center";
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <Button variant="ghost" className="px-2 md:hidden" onClick={onMenuClick} aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>
      <h1 className="text-sm font-semibold text-foreground">{currentTitle(pathname)}</h1>
    </header>
  );
}
