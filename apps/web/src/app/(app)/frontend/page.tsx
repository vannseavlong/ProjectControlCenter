"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink,
  GitFork,
  Globe,
  GripVertical,
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
import { useDeleteProject, useDeployStatus, useProjects, useReorderProjects } from "@/hooks/useProjects";
import { formatRelativeTime, platformLabel, projectLiveTone } from "@/lib/format";
import { usePageSize } from "@/hooks/usePageSize";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SeoScoreBadge } from "@/components/SeoScoreBadge";

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

/**
 * Drag handle shared by the card and the list row. Dragging only starts from this handle, not the
 * whole card/row — both are full of links and a dropdown, which a whole-item drag listener would
 * fight with. Keyboard reordering works too: focus the handle, Space to pick up, arrows, Space.
 */
function DragHandle({
  name,
  attributes,
  listeners,
  className,
}: {
  name: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Reorder ${name}`}
      className={`inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing ${className ?? ""}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

function useSortableItem(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // CSS.Translate, not CSS.Transform: the scale component dnd-kit computes when neighbours differ
  // in size would stretch cards/rows mid-drag.
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };
  return { attributes, listeners, setNodeRef, style, isDragging };
}

function SiteCard({ project }: { project: Project }) {
  const { data } = useDeployStatus(project._id, Boolean(project.vercel_project_id || project.url));
  const [imageFailed, setImageFailed] = useState(false);
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableItem(project._id);

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`relative flex h-full flex-col gap-3 p-0 overflow-hidden ${isDragging ? "shadow-lg ring-1 ring-primary" : ""}`}>
        <DragHandle
          name={project.project_name}
          attributes={attributes}
          listeners={listeners}
          className="absolute left-2 top-2 z-10 bg-background/80 backdrop-blur"
        />
        <Link
          href={`/frontend/${project._id}`}
          className="flex aspect-[1200/630] max-h-48 items-center justify-center overflow-hidden bg-muted text-muted-foreground"
        >
          {project.thumbnail_url && !imageFailed ? (
            // Plain <img>, not next/image: thumbnail URLs point at arbitrary external domains (each
            // site's own og:image), not viable with next/image's fixed remote hostname allowlist.
            // min-h-0: as a flex item, <img> defaults to an automatic min-height based on its own
            // intrinsic size, which can override the parent's aspect-[1200/630] ratio for tall/square
            // source images and stretch the whole card — min-h-0 (plus overflow-hidden above) forces
            // it to respect this box instead. aspect-[1200/630] is applied to both this parent div
            // and the <img> itself (1.91:1, the standard og:image/twitter:image dimensions) so the
            // ratio is enforced on the actual rendered image box, not just inferred from the parent's
            // flex sizing — well-formed thumbnails fill it exactly with no letterboxing.
            // object-contain (not object-cover): og:image sources aren't always standard-ratio —
            // logos/portrait art still show in full, scaled to fit and letterboxed on bg-muted rather
            // than cropped.
            <img
              src={project.thumbnail_url}
              alt={`${project.project_name} thumbnail`}
              loading="lazy"
              className="aspect-[1200/630] size-full min-h-0 object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ImageOff className="size-6" aria-hidden />
          )}
        </Link>
        <div className="space-y-2 px-4 pb-4">
          <Link href={`/frontend/${project._id}`} className="flex items-center justify-between gap-2">
            <span className="truncate font-medium hover:text-primary">{project.project_name}</span>
            <StatusDot tone={projectLiveTone(data?.deployment, data?.reachability)} />
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{formatRelativeTime(data?.deployment?.createdAt ?? project.last_checked)}</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Badge variant="outline">{platformLabel(project.platform)}</Badge>
              <SeoScoreBadge score={project.seo_score} />
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
    </div>
  );
}

/** Compact list-view counterpart to `SiteCard` — mirrors `/backend`'s `Table` styling (name, status,
 * last-deployed, actions). Thumbnails intentionally don't show here, per the task brief. */
function SiteListRow({ project }: { project: Project }) {
  const { data } = useDeployStatus(project._id, Boolean(project.vercel_project_id || project.url));
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableItem(project._id);

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-muted" : undefined}>
      <TableCell className="w-8 pr-0">
        <DragHandle name={project.project_name} attributes={attributes} listeners={listeners} />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5">
          <Link href={`/frontend/${project._id}`} className="hover:text-primary">
            {project.project_name}
          </Link>
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
      <TableCell>
        <SeoScoreBadge score={project.seo_score} />
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
  const [pageSize, setPageSize] = usePageSize("pcc:frontend-page-size");
  const reorderProjects = useReorderProjects();
  const sensors = useSensors(
    // 5px activation distance so a plain click on the handle (e.g. to focus it) isn't a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Arrives from GET /api/projects already in saved sort_order — see that route.
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

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / pageSize));
  // Clamp rather than useEffect-and-resync: a search that shrinks the result set below the current
  // page number should just show the last valid page, no extra render/flash needed.
  const currentPage = Math.min(page, totalPages);
  const pageSites = filteredSites.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Drags happen within the visible (filtered, paginated) slice, but the move is applied to the
  // full frontend roster by index — so dropping A onto B's slot puts A exactly where B was in the
  // whole list, and every hidden site keeps its place. The full order is what gets persisted.
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = sites.map((p) => p._id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    reorderProjects.mutate(arrayMove(ids, from, to));
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPage(1);
  }

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
            <Skeleton key={i} className="aspect-[1200/630] w-full" />
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={pageSites.map((p) => p._id)} strategy={rectSortingStrategy}>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {pageSites.map((project) => (
                    <SiteCard key={project._id} project={project} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <Card>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 pr-0">
                        <span className="sr-only">Reorder</span>
                      </TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SEO</TableHead>
                      <TableHead>Last deployed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext items={pageSites.map((p) => p._id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {pageSites.map((project) => (
                        <SiteListRow key={project._id} project={project} />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </DndContext>
            </Card>
          )}

          {filteredSites.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {filteredSites.length} site{filteredSites.length === 1 ? "" : "s"}
                </p>
                <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
              </div>
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
