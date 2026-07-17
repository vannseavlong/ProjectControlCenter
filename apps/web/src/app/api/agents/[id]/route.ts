import { agentsTable } from "@pcc/db";
import type { AgentStatus } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

const AGENT_STATUSES: AgentStatus[] = ["active", "paused", "fired"];

/**
 * Partial update — only fields present in the request body are applied, same "present in body"
 * convention as `PATCH /api/projects/[id]`. Supports status transitions (pause/resume/fire) and
 * voice selection (`voice_uri`/`voice_name`) independently — a request can patch just one, both,
 * or neither is rejected as a no-op. `last_active` is only bumped when `status` is actually part
 * of the request, not on a voice-only patch. Other field edits (brief, path, etc.) still aren't
 * exposed here; hard delete is DELETE below.
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
