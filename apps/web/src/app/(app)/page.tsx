"use client";

import Link from "next/link";
import { Activity, Server, Globe, Users, Timer, CheckCircle2 } from "lucide-react";
import { AreaTrendChart, Card, DonutChart, EmptyState, Skeleton, StatusDot, type DonutChartSlice } from "@pcc/ui";
import type { PingLog } from "@pcc/types";
import { useDeployStatuses, useProjects } from "@/hooks/useProjects";
import { useAgents } from "@/hooks/useAgents";
import { usePingLogs } from "@/hooks/usePingLogs";
import { formatRelativeTime, formatResponseTime, projectLiveTone } from "@/lib/format";
import { pingStatusToTone } from "@/lib/status";

const TREND_WINDOW_DAYS = 14;

/** Buckets ping logs into daily average response times — days with no pings are omitted rather
 * than zero-filled, since a 0ms dip would misread as "instant response" instead of "no data". */
function buildResponseTimeTrend(pingLogs: PingLog[] | undefined) {
  if (!pingLogs || pingLogs.length === 0) return [];

  const buckets = new Map<string, { sum: number; count: number }>();
  const today = new Date();
  for (let i = TREND_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), { sum: 0, count: 0 });
  }

  for (const log of pingLogs) {
    if (log.response_time_ms === undefined) continue;
    const key = log._created_at.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.sum += log.response_time_ms;
    bucket.count += 1;
  }

  return Array.from(buckets.entries())
    .filter(([, { count }]) => count > 0)
    .map(([key, { sum, count }]) => ({
      label: new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: Math.round(sum / count),
    }));
}

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

  // Frontend projects never get /health-pinged like backend services, so project.status is never
  // updated for them — Vercel's deployment readyState (or, for non-Vercel hosting, a bare-URL
  // reachability ping) is the only real live signal, see lib/format.ts's projectLiveTone.
  const frontendProjects = projects?.filter((p) => p.type === "frontend") ?? [];
  const frontendProjectsWithUrl = frontendProjects.filter((p) => p.vercel_project_id || p.url);
  const deployStatuses = useDeployStatuses(frontendProjectsWithUrl.map((p) => p._id));
  const frontendLive = deployStatuses.filter(
    (q) => projectLiveTone(q.data?.deployment, q.data?.reachability) === "up",
  ).length;

  const activeAgents = agents?.filter((a) => a.status === "active").length ?? 0;

  const projectById = new Map((projects ?? []).map((p) => [p._id, p]));

  const responseTimes = (pingLogs ?? [])
    .map((l) => l.response_time_ms)
    .filter((v): v is number => v !== undefined);
  const avgResponseTime = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : undefined;
  const successRate =
    pingLogs && pingLogs.length > 0
      ? Math.round((pingLogs.filter((l) => l.status === "success").length / pingLogs.length) * 100)
      : undefined;
  const responseTimeTrend = buildResponseTimeTrend(pingLogs);

  // Same live-tone reasoning as the "Backend up"/"Frontend live" cards above: backend project.status
  // is already a real health signal, but frontend needs projectLiveTone's deploy/reachability fallback.
  const deployStatusByProjectId = new Map(frontendProjectsWithUrl.map((p, i) => [p._id, deployStatuses[i]]));
  const liveTones = [
    ...backendProjects.map((p) => p.status),
    ...frontendProjects.map((p) => {
      if (!p.vercel_project_id && !p.url) return "unknown" as const;
      const q = deployStatusByProjectId.get(p._id);
      return projectLiveTone(q?.data?.deployment, q?.data?.reachability);
    }),
  ];
  const statusCounts = { up: 0, down: 0, sleeping: 0, unknown: 0 };
  for (const tone of liveTones) statusCounts[tone] += 1;
  const statusSlices: DonutChartSlice[] = [
    { key: "up", label: "Up", value: statusCounts.up, tone: "up" },
    { key: "sleeping", label: "Sleeping", value: statusCounts.sleeping, tone: "sleeping" },
    { key: "down", label: "Down", value: statusCounts.down, tone: "down" },
    { key: "unknown", label: "Unknown", value: statusCounts.unknown, tone: "unknown" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
        <SummaryCard
          icon={Timer}
          label="Avg response"
          value={formatResponseTime(avgResponseTime)}
          loading={pingLogsLoading}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Success rate"
          value={successRate === undefined ? "—" : `${successRate}%`}
          loading={pingLogsLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Response time trend</h2>
          <p className="mb-4 text-xs text-muted-foreground">Daily average · last {TREND_WINDOW_DAYS} days</p>
          {pingLogsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <AreaTrendChart
              points={responseTimeTrend}
              valueFormatter={(v) => formatResponseTime(v)}
              emptyMessage="Not enough ping history yet to chart a trend."
            />
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-foreground">Live status</h2>
          <p className="mb-4 text-xs text-muted-foreground">Across all projects, right now</p>
          {projectsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <DonutChart slices={statusSlices} centerLabel="Projects" emptyMessage="No projects yet." />
          )}
        </Card>
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
