"use client";

import { Server, Zap } from "lucide-react";
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
} from "@pcc/ui";
import type { Project } from "@pcc/types";
import { useProjects, useWakeProject } from "@/hooks/useProjects";
import { usePingLogs } from "@/hooks/usePingLogs";
import { formatRelativeTime } from "@/lib/format";
import { AddProjectDialog } from "@/components/AddProjectDialog";

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
                <TableHead>Last checked</TableHead>
                <TableHead>Response time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((project) => {
                const responseTimes = (pingLogs ?? [])
                  .filter((log) => log.project_id === project._id && log.response_time_ms !== undefined)
                  .slice()
                  .reverse()
                  .map((log) => log.response_time_ms as number);

                return (
                  <TableRow key={project._id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{project.project_name}</span>
                        {project.url ? (
                          <a href={project.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                            {project.url}
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusDot tone={project.status} label={project.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatRelativeTime(project.last_checked)}
                    </TableCell>
                    <TableCell>
                      <Sparkline values={responseTimes} />
                    </TableCell>
                    <TableCell className="text-right">
                      <WakeButton project={project} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Phase 2</Badge>
        Uptime history charts land once historical ping data is worth graphing per-service.
      </Card>
    </div>
  );
}
