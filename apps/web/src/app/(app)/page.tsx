"use client";

import Link from "next/link";
import { Activity, Server, Globe, Users } from "lucide-react";
import { Card, EmptyState, Skeleton, StatusDot } from "@pcc/ui";
import { useDeployStatuses, useProjects } from "@/hooks/useProjects";
import { useAgents } from "@/hooks/useAgents";
import { usePingLogs } from "@/hooks/usePingLogs";
import { formatRelativeTime, formatResponseTime } from "@/lib/format";
import { pingStatusToTone } from "@/lib/status";

function SummaryCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="font-mono text-xl font-semibold">{value}</p>}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: pingLogs, isLoading: pingLogsLoading } = usePingLogs();

  const backendProjects = projects?.filter((p) => p.type === "backend") ?? [];
  const backendUp = backendProjects.filter((p) => p.status === "up").length;

  // Frontend (Vercel) projects never get /health-pinged like backend services, so project.status
  // is never updated for them — Vercel's own deployment readyState is the only real live signal
  // (same fix as the /frontend page's status dot, see lib/format.ts's deployReadyStateToTone).
  const frontendProjects = projects?.filter((p) => p.type === "frontend") ?? [];
  const frontendProjectsWithVercelId = frontendProjects.filter((p) => p.vercel_project_id);
  const deployStatuses = useDeployStatuses(frontendProjectsWithVercelId.map((p) => p._id));
  const frontendLive = deployStatuses.filter((q) => q.data?.readyState === "READY").length;

  const activeAgents = agents?.filter((a) => a.status === "active").length ?? 0;

  const projectById = new Map((projects ?? []).map((p) => [p._id, p]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Server}
          label="Backend up"
          value={`${backendUp} / ${backendProjects.length}`}
          loading={projectsLoading}
        />
        <SummaryCard
          icon={Globe}
          label="Frontend live"
          value={`${frontendLive} / ${frontendProjects.length}`}
          loading={projectsLoading}
        />
        <SummaryCard icon={Users} label="Active agents" value={String(activeAgents)} loading={agentsLoading} />
        <SummaryCard
          icon={Activity}
          label="Pings logged"
          value={String(pingLogs?.length ?? 0)}
          loading={pingLogsLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Recent ping activity</h2>
          {pingLogsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !pingLogs || pingLogs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No pings yet"
              description="Health checks will show up here once a project is pinged or the cron job runs."
            />
          ) : (
            <ul className="space-y-1">
              {pingLogs.slice(0, 10).map((log) => {
                const project = projectById.get(log.project_id);
                return (
                  <li key={log._id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40">
                    <div className="flex items-center gap-2 truncate">
                      <StatusDot tone={pingStatusToTone(log.status)} />
                      <span className="truncate">{project?.project_name ?? log.project_id}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span>{formatResponseTime(log.response_time_ms)}</span>
                      <span>{formatRelativeTime(log._created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Quick links</h2>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/backend" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
              Backend Services →
            </Link>
            <Link href="/frontend" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
              Frontend Sites →
            </Link>
            <Link href="/agents" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
              Agent Staff →
            </Link>
          </nav>
        </Card>
      </div>
    </div>
  );
}
