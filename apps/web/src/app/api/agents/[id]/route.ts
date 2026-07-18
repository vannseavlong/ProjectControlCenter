import { agentsTable, projectsTable } from "@pcc/db";
import type { AgentStatus } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

const AGENT_STATUSES: AgentStatus[] = ["active", "paused", "fired"];

const STRING_FIELDS = ["agent_name", "local_project_path", "brief"] as const;

/**
 * Partial update — only fields present in the request body are applied, same "present in body"
 * convention as `PATCH /api/projects/[id]`. Supports status transitions (pause/resume/fire),
 * voice selection (`voice_uri`/`voice_name`), and staffing edits (`agent_name`,
 * `assigned_project_id` — i.e. reassigning/"repositioning" an agent to a different project —
 * `local_project_path`, `brief`) independently; a request can patch any combination, or is
 * rejected as a no-op if none are present. `last_active` is only bumped when `status` is
 * actually part of the request. Hard delete is DELETE below.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const existing = await agentsTable().findOne({ where: { _id: id } });
    if (!existing) {
      return apiError(404, `No agent with id ${id}`);
    }

    const data: Record<string, unknown> = {};

    if ("status" in body) {
      const { status } = body;
      if (typeof status !== "string" || !AGENT_STATUSES.includes(status as AgentStatus)) {
        return apiError(400, `status must be one of: ${AGENT_STATUSES.join(", ")}`);
      }
      data.status = status as AgentStatus;
      data.last_active = new Date().toISOString();
    }

    if ("voice_uri" in body) {
      const { voice_uri } = body;
      if (typeof voice_uri !== "string") {
        return apiError(400, "voice_uri must be a string");
      }
      data.voice_uri = voice_uri;
    }

    if ("voice_name" in body) {
      const { voice_name } = body;
      if (typeof voice_name !== "string") {
        return apiError(400, "voice_name must be a string");
      }
      data.voice_name = voice_name;
    }

    if ("assigned_project_id" in body) {
      const { assigned_project_id } = body;
      if (typeof assigned_project_id !== "string" || assigned_project_id.trim().length === 0) {
        return apiError(400, "assigned_project_id must be a non-empty string");
      }
      const project = await projectsTable().findOne({ where: { _id: assigned_project_id } });
      if (!project) {
        return apiError(400, `No project with id ${assigned_project_id}`);
      }
      data.assigned_project_id = assigned_project_id;
    }

    for (const field of STRING_FIELDS) {
      if (field in body) {
        const value = body[field];
        if (typeof value !== "string") {
          return apiError(400, `${field} must be a string`);
        }
        if (field === "agent_name" && value.trim().length === 0) {
          return apiError(400, "agent_name must be a non-empty string");
        }
        if (field === "local_project_path" && value.trim().length === 0) {
          return apiError(400, "local_project_path must be a non-empty string");
        }
        data[field] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return apiError(400, "No editable fields present in request body");
    }

    await agentsTable().update({ where: { _id: id }, data });

    const agent = await agentsTable().findOne({ where: { _id: id } });
    return apiOk({ agent });
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const existing = await agentsTable().findOne({ where: { _id: id } });
    if (!existing) {
      return apiError(404, `No agent with id ${id}`);
    }

    await agentsTable().delete({ where: { _id: id } });
    return apiOk({ deleted: true, id });
  });
}
