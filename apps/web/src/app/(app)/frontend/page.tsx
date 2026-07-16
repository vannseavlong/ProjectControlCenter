"use client";

import { useState } from "react";
import { ExternalLink, GitFork, Globe, ImageOff, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Skeleton, StatusDot } from "@pcc/ui";
import type { Project } from "@pcc/types";
import { useDeleteProject, useProjects, useDeployStatus } from "@/hooks/useProjects";
import { formatRelativeTime } from "@/lib/format";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function SiteCard({ project }: { project: Project }) {
  const { data: deployment } = useDeployStatus(project._id, Boolean(project.vercel_project_id));
  const deleteProject = useDeleteProject();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-0 overflow-hidden">
      <div className="flex aspect-video max-h-48 items-center justify-center overflow-hidden bg-muted text-muted-foreground">
        {project.thumbnail_url && !imageFailed ? (
          // Plain <img>, not next/image: thumbnail URLs point at arbitrary external domains (each
          // site's own og:image), not viable with next/image's fixed remote hostname allowlist.
          // min-h-0: as a flex item, <img> defaults to an automatic min-height based on its own
          // intrinsic size, which can override the parent's aspect-video ratio for tall/square
          // source images and stretch the whole card — min-h-0 (plus overflow-hidden above) forces
          // it to respect this box instead. object-contain (not object-cover): og:image sources are
          // often logos/portrait art, not photos — scale to fit and letterbox on bg-muted rather
          // than cropping content off.
          <img
            src={project.thumbnail_url}
            alt={`${project.project_name} thumbnail`}
            loading="lazy"
            className="size-full min-h-0 object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <ImageOff className="size-6" aria-hidden />
        )}
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
        {project.vercel_project_id ? (
          <span className="block truncate font-mono text-[10px] text-muted-foreground">{project.vercel_project_id}</span>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
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
          </div>
          <div className="flex items-center gap-1">
            <AddProjectDialog type="frontend" editingProject={project} />
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
          </div>
        </div>
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
        <Badge variant="outline">Note</Badge>
        Thumbnails come from each site&apos;s own Open Graph image — sites without one show a
        placeholder.
      </Card>
    </div>
  );
}
