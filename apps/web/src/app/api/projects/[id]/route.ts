import { agentsTable, pingLogsTable, projectsTable } from "@pcc/db";
import type { ProjectPlatform, ProjectType } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { fetchOgImageUrl } from "@/lib/og-image";
import { pingHealth } from "@/lib/render";

/** Same rationale as POST /api/projects' CREATE_PROBE_TIMEOUT_MS — keep the edit-save snappy. */
const UPDATE_PROBE_TIMEOUT_MS = 5_000;

const PROJECT_TYPES: ProjectType[] = ["frontend", "backend"];
const PROJECT_PLATFORMS: ProjectPlatform[] = ["vercel", "render", "other"];

const STRING_FIELDS = ["repo_url", "render_service_id", "vercel_project_id", "url", "notes"] as const;

/** Partial update — only fields present in the request body are applied, everything else is left untouched. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const existing = await projectsTable().findOne({ where: { _id: id } });
    if (!existing) {
      return apiError(404, `No project with id ${id}`);
    }

    const data: Record<string, unknown> = {};

    if ("project_name" in body) {
      const { project_name } = body;
      if (typeof project_name !== "string" || project_name.trim().length === 0) {
        return apiError(400, "project_name must be a non-empty string");
      }
      data.project_name = project_name;
    }

    if ("type" in body) {
      const { type } = body;
      if (typeof type !== "string" || !PROJECT_TYPES.includes(type as ProjectType)) {
        return apiError(400, `type must be one of: ${PROJECT_TYPES.join(", ")}`);
      }
      data.type = type as ProjectType;
    }

    if ("platform" in body) {
      const { platform } = body;
      if (typeof platform !== "string" || !PROJECT_PLATFORMS.includes(platform as ProjectPlatform)) {
        return apiError(400, `platform must be one of: ${PROJECT_PLATFORMS.join(", ")}`);
      }
      data.platform = platform as ProjectPlatform;
    }

    for (const field of STRING_FIELDS) {
      if (field in body) {
        const value = body[field];
        if (typeof value !== "string") {
          return apiError(400, `${field} must be a string`);
        }
        data[field] = value;
      }
    }

    if ("has_health_endpoint" in body) {
      const { has_health_endpoint } = body;
      if (typeof has_health_endpoint !== "boolean") {
        return apiError(400, "has_health_endpoint must be a boolean");
      }
      data.has_health_endpoint = has_health_endpoint;
    }

    // Best-effort re-scrape of the thumbnail, and (for backend services) a re-probe of `/health`,
    // whenever `url` is being set (same rationale as POST /api/projects — see
    // Tasks/app-backend.md §3). Run concurrently, same as on create. effectiveType accounts for
    // `type` being changed in this same request, not just the project's existing stored type.
    const urlBeingSet = typeof data.url === "string" && data.url.length > 0;
    const effectiveType = (typeof data.type === "string" ? data.type : existing.type) as ProjectType;
    const [thumbnailUrl, healthProbe] = await Promise.all([
      urlBeingSet ? fetchOgImageUrl(data.url as string) : Promise.resolve(null),
      urlBeingSet && effectiveType === "backend"
        ? pingHealth(data.url as string, UPDATE_PROBE_TIMEOUT_MS)
        : Promise.resolve(null),
    ]);
    // Only overwrites thumbnail_url when the fetch actually finds an image — a transient
    // failure/timeout leaves the existing thumbnail untouched rather than clobbering it with null.
    if (thumbnailUrl) {
      data.thumbnail_url = thumbnailUrl;
    }
    // A conclusive live probe beats whatever the edit form's checkbox submitted in this same
    // request, same rule as create — see that route for why.
    if (healthProbe && healthProbe.healthEndpointDetected !== null) {
      data.has_health_endpoint = healthProbe.healthEndpointDetected;
    }

    if (Object.keys(data).length === 0) {
      return apiError(400, "No editable fields present in request body");
    }

    await projectsTable().update({ where: { _id: id }, data });
    const project = await projectsTable().findOne({ where: { _id: id } });
    return apiOk({ project });
  });
}

/**
 * Hard delete. Two decisions worth documenting since they diverge from the (simpler)
 * `DELETE /api/agents/:id` this route otherwise mirrors:
 *  - `agents.assigned_project_id` is a `.ref("projects._id")` (required) column — an active or
 *    paused agent still assigned to this project would be left pointing at a dead project_id
 *    with no way to fix it via the API (agent PATCH only supports status transitions, not
 *    reassignment). Rather than silently orphaning that reference, block the delete with 409
 *    unless every assigned agent has already been fired. Fired agents are inert (no more polling/
 *    execution against the project) so their stale reference is harmless clutter, same as
 *    ping_logs below — deleting the project doesn't un-fire anything.
 *  - `ping_logs.project_id` is also a `.ref("projects._id")` but ping_logs are pure history (the
 *    Dashboard/health views only ever read them, never act on them), so an orphaned row is inert
 *    clutter, not a broken reference someone needs to act on. Cascade-deleting them keeps the
 *    table from accumulating dead rows over time, which was the more likely long-run confusion
 *    per the task brief. Count of deleted rows is echoed back for transparency.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const existing = await projectsTable().findOne({ where: { _id: id } });
    if (!existing) {
      return apiError(404, `No project with id ${id}`);
    }

    const assignedAgents = await agentsTable().findMany({ where: { assigned_project_id: id } });
    const activeAgents = assignedAgents.filter((agent) => agent.status !== "fired");
    if (activeAgents.length > 0) {
      return apiError(
        409,
        `Cannot delete project: ${activeAgents.length} agent(s) still assigned and not fired (${activeAgents
          .map((agent) => agent.agent_name)
          .join(", ")}). Fire them first via PATCH /api/agents/:id.`,
      );
    }

    const cascadedPingLogs = await pingLogsTable().delete({ where: { project_id: id } });
    await projectsTable().delete({ where: { _id: id } });
    return apiOk({ deleted: true, id, cascadedPingLogs });
  });
}
