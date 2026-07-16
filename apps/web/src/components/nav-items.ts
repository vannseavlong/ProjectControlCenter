import type { LucideIcon } from "lucide-react";
import { Gauge, Server, Globe, Users, Mic, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/backend", label: "Backend Services", icon: Server },
  { href: "/frontend", label: "Frontend Sites", icon: Globe },
  { href: "/agents", label: "Agent Staff", icon: Users },
  { href: "/voice", label: "Voice Console", icon: Mic },
  { href: "/settings", label: "Settings", icon: Settings },
];
