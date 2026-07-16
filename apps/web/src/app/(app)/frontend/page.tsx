"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ExternalLink,
  GitFork,
  Globe,
  ImageOff,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusDot,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pcc/ui";
import type { Project, ProjectPlatform } from "@pcc/types";
import { useDeleteProject, useProjects, useDeployStatus } from "@/hooks/useProjects";
import { formatRelativeTime, platformLabel, projectLiveTone } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const VIEW_STORAGE_KEY = "pcc:frontend-view-mode";

type ViewMode = "grid" | "list";
type PlatformFilter = "all" | ProjectPlatform;

// `useSyncExternalStore`, not a `useState` + `useEffect` resync — reading localStorage inside an
// effect and then calling `setState` triggers the `react-hooks/set-state-in-effect` lint rule
// (cascading extra render) and still has to special-case SSR by hand. `useSyncExternalStore`
// handles both: its `getServerSnapshot` returns "grid" during SSR/hydration (matching the
// server-rendered HTML, no mismatch), then re-reads the real value on the client without an extra
// manual effect.
const viewModeListeners = new Set<() => void>();

function subscribeViewMode(listener: () => void) {
  viewModeListeners.add(listener);
  return () => viewModeListeners.delete(listener);
}

function getViewModeSnapshot(): ViewMode {
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === "grid" || stored === "list" ? stored : "grid";
}

function getViewModeServerSnapshot(): ViewMode {
  return "grid";
}

function setViewMode(next: ViewMode) {
  window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  viewModeListeners.forEach((listener) => listener());
}

function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore(subscribeViewMode, getViewModeSnapshot, getViewModeServerSnapshot);
  return [mode, setViewMode];
}

/**
 * Edit/Delete dropdown for one project, shared by the grid card and the list row. Delete goes
 * through `ConfirmDialog` exactly like `/agents` does for its destructive actions (the
 * `e.preventDefault()` on the item's `onSelect` stops Radix from tearing the dropdown down —
 * and unmounting the nested dialog's trigger with it — before the confirm dialog gets a chance to
 * open).
 *
 * Edit can't reuse that exact trick: `ConfirmDialog` takes a `trigger` prop so the dropdown item
 * itself *is* the dialog trigger, but `AddProjectDialog` owns its own `Dialog` + hardcoded pencil
 * trigger button with no equivalent escape hatch, and it's out of scope to add one here (backend
 * lane owns that file this session). So the visible "Edit" item forwards its click to a real
 * `AddProjectDialog` trigger rendered off-screen instead of re-implementing the edit form —
 * `.click()` on a hidden button still dispatches a real click event, which is all Radix's
 * `DialogTrigger` needs to open.
 */
function SiteActionsMenu({ project }: { project: Project }) {
  const deleteProject = useDeleteProject();
  const editTriggerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="size-8 px-0" aria-label={`Actions for ${project.project_name}`}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              editTriggerRef.current?.querySelector("button")?.click();
            }}
          >
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
          <ConfirmDialog
            trigger={
              <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            }
            title={`Delete ${project.project_name}?`}
            description="Permanently removes this project and its ping history. This can't be undone."
            confirmLabel="Delete"
            onConfirm={() => deleteProject.mutateAsync(project._id)}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <div ref={editTriggerRef} className="hidden">
        <AddProjectDialog type="frontend" editingProject={project} />
      </div>
    </>
  );
}

/**
 * Vercel readyState and bare-URL reachability (for platform "other") are mutually exclusive
 * fields on the same deploy-status response — this renders whichever one the route actually
 * returned, `projectLiveTone` (lib/format.ts) already picked the right one for the status dot.
 */
function DeployStatusBadge({
  deployment,
  reachability,
}: {
  deployment: { readyState: string } | null | undefined;
  reachability: { ok: boolean; timedOut: boolean } | null | undefined;
}) {
  if (deployment) return <Badge variant="outline">{deployment.readyState}</Badge>;
  if (reachability) {
    return (
      <Badge variant="outline">{reachability.ok ? "Reachable" : reachability.timedOut ? "Timed out" : "Unreachable"}</Badge>
    );
  }
  return null;
}

function SiteCard({ project }: { project: Project }) {
  const { data } = useDeployStatus(project._id, Boolean(project.url));
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
          <StatusDot tone={projectLiveTone(data?.deployment, data?.reachability)} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">{formatRelativeTime(data?.deployment?.createdAt ?? project.last_checked)}</span>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline">{platformLabel(project.platform)}</Badge>
            <DeployStatusBadge deployment={data?.deployment} reachability={data?.reachability} />
          </div>
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
          <SiteActionsMenu project={project} />
        </div>
      </div>
    </Card>
  );
}

/** Compact list-view counterpart to `SiteCard` — mirrors `/backend`'s `Table` styling (name, status,
 * last-deployed, actions). Thumbnails intentionally don't show here, per the task brief. */
function SiteListRow({ project }: { project: Project }) {
  const { data } = useDeployStatus(project._id, Boolean(project.url));

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5">
          <span>{project.project_name}</span>
          {project.url ? (
            <a href={project.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary">
              {project.url}
            </a>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{platformLabel(project.platform)}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <StatusDot tone={projectLiveTone(data?.deployment, data?.reachability)} />
          <DeployStatusBadge deployment={data?.deployment} reachability={data?.reachability} />
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatRelativeTime(data?.deployment?.createdAt ?? project.last_checked)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end">
          <SiteActionsMenu project={project} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function FrontendSitesPage() {
  const { data: projects, isLoading } = useProjects();
  const [view, setView] = useViewMode();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [page, setPage] = useState(1);

  const sites = useMemo(() => (projects ?? []).filter((p) => p.type === "frontend"), [projects]);

  // Distinct platforms actually present in the roster, not the full ProjectPlatform union — a
  // filter option for "Render" would be dead/confusing on this tab (frontend sites only ever get
  // created as "vercel" or "other", see AddProjectDialog), but showing exactly what's in the data
  // stays correct even if that ever changes.
  const availablePlatforms = useMemo(
    () => Array.from(new Set(sites.map((p) => p.platform))).sort(),
    [sites],
  );

  // Client-side filtering only, over the list already fetched via React Query — the backend route
  // returns the full roster and there's no page-size large enough yet to justify a server-side
  // search/pagination API (see Tasks/app-backend.md §1).
  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((p) => {
      if (platformFilter !== "all" && p.platform !== platformFilter) return false;
      if (!q) return true;
      return p.project_name.toLowerCase().includes(q) || (p.url ?? "").toLowerCase().includes(q);
    });
  }, [sites, search, platformFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / PAGE_SIZE));
  // Clamp rather than useEffect-and-resync: a search that shrinks the result set below the current
  // page number should just show the last valid page, no extra render/flash needed.
  const currentPage = Math.min(page, totalPages);
  const pageSites = filteredSites.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handlePlatformFilterChange(value: PlatformFilter) {
    setPlatformFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Frontend Sites</h1>
        <AddProjectDialog type="frontend" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name or URL…"
                  className="pl-8"
                  aria-label="Search frontend sites"
                />
              </div>
              {availablePlatforms.length > 1 ? (
                <Select value={platformFilter} onValueChange={(value) => handlePlatformFilterChange(value as PlatformFilter)}>
                  <SelectTrigger className="w-36" aria-label="Filter by platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All platforms</SelectItem>
                    {availablePlatforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platformLabel(platform)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-input p-0.5">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                className="h-8 px-2 text-xs"
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="size-3.5" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                className="h-8 px-2 text-xs"
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List className="size-3.5" />
              </Button>
            </div>
          </div>

          {filteredSites.length === 0 ? (
            <Card>
              <EmptyState
                icon={Search}
                title="No matches"
                description={
                  search
                    ? `No frontend sites match "${search}".`
                    : `No frontend sites on platform "${platformFilter === "all" ? "" : platformLabel(platformFilter)}".`
                }
              />
            </Card>
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {pageSites.map((project) => (
                <SiteCard key={project._id} project={project} />
              ))}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last deployed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSites.map((project) => (
                    <SiteListRow key={project._id} project={project} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {filteredSites.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {filteredSites.length} site{filteredSites.length === 1 ? "" : "s"}
              </p>
              <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}

      <Card className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Note</Badge>
        Thumbnails come from each site&apos;s own Open Graph image — sites without one show a
        placeholder.
      </Card>
    </div>
  );
}
