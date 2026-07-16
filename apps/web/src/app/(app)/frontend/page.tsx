"use client";

import { ExternalLink, Globe, ImageOff } from "lucide-react";
import { Badge, Card, EmptyState, Skeleton, StatusDot } from "@pcc/ui";
import type { Project } from "@pcc/types";
import { useProjects, useDeployStatus } from "@/hooks/useProjects";
import { formatRelativeTime } from "@/lib/format";
import { AddProjectDialog } from "@/components/AddProjectDialog";

function SiteCard({ project }: { project: Project }) {
  const { data: deployment } = useDeployStatus(project._id, Boolean(project.vercel_project_id));

  return (
    <Card className="flex flex-col gap-3 p-0 overflow-hidden">
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <ImageOff className="size-6" aria-hidden />
      </div>
      <div className="space-y-2 px-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{project.project_name}</span>
          <StatusDot tone={project.status} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">{formatRelativeTime(deployment?.createdAt ?? project.last_checked)}</span>
          {deployment ? <Badge variant="outline">{deployment.readyState}</Badge> : null}
        </div>
        {project.url ? (
          <a
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open site <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
    </Card>
  );
}

export default function FrontendSitesPage() {
  const { data: projects, isLoading } = useProjects();
  const sites = (projects ?? []).filter((p) => p.type === "frontend");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Frontend Sites</h1>
        <AddProjectDialog type="frontend" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <Card>
          <EmptyState
            icon={Globe}
            title="No frontend sites yet"
            description="Add a Vercel project to start tracking its deploy status."
            action={<AddProjectDialog type="frontend" />}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((project) => (
            <SiteCard key={project._id} project={project} />
          ))}
        </div>
      )}

      <Card className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Phase 2</Badge>
        Thumbnails land once the screenshot service is wired up — placeholder tiles for now.
      </Card>
    </div>
  );
}
