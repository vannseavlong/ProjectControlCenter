"use client";

import { GitFork, Server, TriangleAlert, Trash2, Zap } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Sparkline,
  StatusDot,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  UptimeHistory,
} from "@pcc/ui";
import type { PingLog, Project } from "@pcc/types";
import { useDeleteProject, useProjects, useWakeProject } from "@/hooks/useProjects";
import { usePingLogs } from "@/hooks/usePingLogs";
import { formatRelativeTime, pingStatusToTone } from "@/lib/format";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/** Ping logs for one project, chronological (oldest first) — feeds both the row sparkline and the history section below. */
function projectPingLogsAscending(pingLogs: PingLog[] | undefined, projectId: string): PingLog[] {
  return (pingLogs ?? [])
    .filter((log) => log.project_id === projectId)
    .slice()
    .sort((a, b) => new Date(a._created_at).getTime() - new Date(b._created_at).getTime());
}

function WakeButton({ project }: { project: Project }) {
  const wakeProject = useWakeProject();
  return (
    <Button
      variant="secondary"
      className="h-8 px-2 text-xs"
      disabled={wakeProject.isPending}
      onClick={() => wakeProject.mutate(project._id)}
    >
      <Zap className="size-3.5" />
      {wakeProject.isPending ? "Waking…" : "Wake up"}
    </Button>
  );
}

/** Yes/No/— indicator for every row, not just a warning when it's missing — lets the user scan the whole roster at a glance. */
function HealthEndpointBadge({ hasHealthEndpoint }: { hasHealthEndpoint: boolean | undefined }) {
  if (hasHealthEndpoint === false) {
    return (
      <Badge variant="outline" className="border-status-sleeping/40 text-status-sleeping">
        <TriangleAlert className="size-3" aria-hidden />
        No
      </Badge>
    );
  }
  if (hasHealthEndpoint === true) {
    return (
      <Badge variant="outline" className="border-status-up/40 text-status-up">
        Yes
      </Badge>
    );
  }
  // Legacy row created before this field existed — genuinely unknown, don't guess either way.
  return <span className="text-xs text-muted-foreground">—</span>;
}

function DeleteProjectButton({ project }: { project: Project }) {
  const deleteProject = useDeleteProject();
  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          className="h-8 px-2 text-xs text-destructive hover:text-destructive"
          aria-label={`Delete ${project.project_name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      }
      title={`Delete ${project.project_name}?`}
      description="Permanently removes this project and its ping history. This can't be undone."
      confirmLabel="Delete"
      onConfirm={() => deleteProject.mutateAsync(project._id)}
    />
  );
}

export default function BackendServicesPage() {
  const { data: projects, isLoading } = useProjects();
  const { data: pingLogs } = usePingLogs();

  const services = (projects ?? []).filter((p) => p.type === "backend");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Backend Services</h1>
        <AddProjectDialog type="backend" />
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No backend services yet"
            description="Add a Render service to start monitoring its health."
            action={<AddProjectDialog type="backend" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health API</TableHead>
                <TableHead>Last checked</TableHead>
                <TableHead>Response time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((project) => {
                const responseTimes = projectPingLogsAscending(pingLogs, project._id)
                  .filter((log) => log.response_time_ms !== undefined)
                  .map((log) => log.response_time_ms as number);

                return (
                  <TableRow key={project._id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{project.project_name}</span>
                        {project.url ? (
                          <a href={project.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                            {project.url}
                          </a>
                        ) : null}
                        {project.repo_url || project.render_service_id ? (
                          <div className="flex items-center gap-2">
                            {project.repo_url ? (
                              <a
                                href={project.repo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                              >
                                <GitFork className="size-3" aria-hidden /> Repo
                              </a>
                            ) : null}
                            {project.render_service_id ? (
                              <span className="font-mono text-[10px] text-muted-foreground">{project.render_service_id}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusDot tone={project.status} label={project.status} />
                    </TableCell>
                    <TableCell>
                      <HealthEndpointBadge hasHealthEndpoint={project.has_health_endpoint} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatRelativeTime(project.last_checked)}
                    </TableCell>
                    <TableCell>
                      <Sparkline values={responseTimes} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <AddProjectDialog type="backend" editingProject={project} />
                        <WakeButton project={project} />
                        <DeleteProjectButton project={project} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {services.length > 0 ? (
        <Card className="space-y-5">
          <h2 className="text-sm font-semibold text-foreground">Uptime history</h2>
          <div className="space-y-5">
            {services.map((project) => {
              const history = projectPingLogsAscending(pingLogs, project._id).map((log) => ({
                tone: pingStatusToTone(log.status),
                responseTimeMs: log.response_time_ms,
                timestamp: log._created_at,
              }));

              return (
                <div key={project._id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{project.project_name}</span>
                    <span className="text-muted-foreground">
                      {history.length} ping{history.length === 1 ? "" : "s"} recorded
                    </span>
                  </div>
                  <UptimeHistory points={history} />
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
