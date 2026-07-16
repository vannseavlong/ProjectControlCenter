import { agentsTable } from "@pcc/db";
import type { AgentStatus } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

const AGENT_STATUSES: AgentStatus[] = ["active", "paused", "fired"];

/** Status transitions only — pause/resume/fire. Field edits (brief, path, etc.) aren't exposed here; hard delete is DELETE below. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const { status } = body;
    if (typeof status !== "string" || !AGENT_STATUSES.includes(status as AgentStatus)) {
      return apiError(400, `status must be one of: ${AGENT_STATUSES.join(", ")}`);
    }

    const existing = await agentsTable().findOne({ where: { _id: id } });
    if (!existing) {
      return apiError(404, `No agent with id ${id}`);
    }

    await agentsTable().update({
      where: { _id: id },
      data: { status: status as AgentStatus, last_active: new Date().toISOString() },
    });

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
