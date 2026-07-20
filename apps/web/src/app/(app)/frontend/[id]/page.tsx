"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, GitFork, Search, Trash2, TriangleAlert, XCircle, Zap } from "lucide-react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@pcc/ui";
import type { SeoCheckResult, SeoCheckStatus, SeoSegmentKey } from "@pcc/types";
import { useAnalyzeSeo, useDeleteProject, useProjects } from "@/hooks/useProjects";
import { formatRelativeTime, platformLabel, seoScoreTone } from "@/lib/format";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SEO_TONE_CLASSES, SeoScoreBadge } from "@/components/SeoScoreBadge";

const SEGMENT_LABELS: Record<SeoSegmentKey, string> = {
  meta: "Meta",
  social: "Social",
  technical: "Technical",
  accessibility: "Accessibility",
};

const SEGMENT_ORDER: SeoSegmentKey[] = ["meta", "social", "technical", "accessibility"];

const STATUS_ICON: Record<SeoCheckStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: TriangleAlert,
  fail: XCircle,
};

/** Plain tone-colored `<div>` width bar — no chart dependency, per Tasks/app-frontend.md §3a (DonutChart is for part-to-whole slices, doesn't fit a single 0–100 gauge). */
function SegmentScoreBar({ label, score }: { label: string; score: number }) {
  const tone = seoScoreTone(score);
  const toneClasses = SEO_TONE_CLASSES[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className={`font-mono text-xs ${toneClasses.text}`}>{score}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${toneClasses.bg}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: SeoCheckResult }) {
  const Icon = STATUS_ICON[check.status];
  const toneClasses =
    check.status === "pass"
      ? SEO_TONE_CLASSES.up
      : check.status === "warn"
        ? SEO_TONE_CLASSES.sleeping
        : SEO_TONE_CLASSES.down;
  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <Icon className={`mt-0.5 size-4 shrink-0 ${toneClasses.text}`} aria-hidden />
      <div className="space-y-0.5">
        <p className="font-medium text-foreground">{check.label}</p>
        <p className="text-xs text-muted-foreground">{check.detail}</p>
      </div>
    </div>
  );
}

export default function FrontendSiteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const analyzeSeo = useAnalyzeSeo();
  const deleteProject = useDeleteProject();

  const project = projects?.find((p) => p._id === params.id);

  const reportBySegment = new Map<SeoSegmentKey, SeoCheckResult[]>();
  for (const check of project?.seo_report ?? []) {
    const existing = reportBySegment.get(check.segment) ?? [];
    existing.push(check);
    reportBySegment.set(check.segment, existing);
  }

  return (
    <div className="space-y-4">
      <Link href="/frontend" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Frontend Sites
      </Link>

      {isLoading ? (
        <Card className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      ) : !project ? (
        <Card>
          <EmptyState title="Project not found" description="It may have been deleted." />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">{project.project_name}</h1>
              <div className="flex flex-wrap items-center gap-3">
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {project.url} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">No URL set</span>
                )}
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
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{platformLabel(project.platform)}</Badge>
              <AddProjectDialog type="frontend" editingProject={project} />
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="h-8 px-2 text-xs text-destructive hover:text-destructive" aria-label={`Delete ${project.project_name}`}>
                    <Trash2 className="size-3.5" />
                  </Button>
                }
                title={`Delete ${project.project_name}?`}
                description="Permanently removes this project and its ping history. This can't be undone."
                confirmLabel="Delete"
                onConfirm={async () => {
                  await deleteProject.mutateAsync(project._id);
                  router.push("/frontend");
                }}
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">SEO analysis</h2>
                {project.seo_last_analyzed ? (
                  <p className="text-xs text-muted-foreground">Last analyzed {formatRelativeTime(project.seo_last_analyzed)}</p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                disabled={analyzeSeo.isPending || !project.url}
                onClick={() => analyzeSeo.mutate(project._id)}
              >
                <Zap className="size-4" />
                {analyzeSeo.isPending ? "Analyzing…" : "Analyze SEO"}
              </Button>
            </div>

            {!project.seo_last_analyzed ? (
              <EmptyState
                icon={Search}
                title="No SEO scan yet"
                description={
                  project.url
                    ? "Run an analysis to score this site's meta tags, social cards, technical SEO, and accessibility."
                    : "Add a URL to this project before it can be analyzed."
                }
              />
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <SeoScoreBadge score={project.seo_score} className="px-3 py-1.5 text-xl font-semibold" />
                  <span className="text-sm text-muted-foreground">Overall score</span>
                </div>

                {project.seo_segment_scores ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {SEGMENT_ORDER.map((segment) => (
                      <SegmentScoreBar
                        key={segment}
                        label={SEGMENT_LABELS[segment]}
                        score={project.seo_segment_scores![segment]}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="space-y-4">
                  {SEGMENT_ORDER.map((segment) => {
                    const checks = reportBySegment.get(segment);
                    if (!checks || checks.length === 0) return null;
                    return (
                      <div key={segment} className="space-y-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {SEGMENT_LABELS[segment]}
                        </h3>
                        <div className="divide-y divide-border">
                          {checks.map((check) => (
                            <CheckRow key={check.id} check={check} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
