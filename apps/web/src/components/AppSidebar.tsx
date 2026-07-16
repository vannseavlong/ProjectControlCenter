"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Rocket } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@pcc/ui";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

interface AppSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ mobileOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Rocket className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-wide">Project Control Center</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {active ? (
                  <span
                    className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                    style={{ boxShadow: "0 0 6px 1px oklch(var(--primary) / 0.7)" }}
                    aria-hidden
                  />
                ) : null}
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="font-mono text-[13px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent/60"
              >
                <Avatar className="size-6">
                  <AvatarFallback className="bg-sidebar-accent text-[11px] text-sidebar-accent-foreground">
                    A
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">Admin</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem disabled className="text-muted-foreground">
                Signed in
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut} variant="destructive">
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
