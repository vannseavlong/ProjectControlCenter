import Link from "next/link";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/backend", label: "Backend Services" },
  { href: "/frontend", label: "Frontend Sites" },
  { href: "/agents", label: "Agent Staff" },
  { href: "/voice", label: "Voice Console" },
  { href: "/settings", label: "Settings" },
] as const;

export function NavBar() {
  return (
    <nav className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
