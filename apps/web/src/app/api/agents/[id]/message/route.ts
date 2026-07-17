import { agentsTable, commandQueueTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

/**
 * Enqueues an instruction for `apps/agent-bridge` to pick up and execute — does not run the
 * agent synchronously. Caller polls `GET /api/commands/:id` for `status`/`result` until it
 * settles (`done`/`failed`); see `Tasks/agent-chat.md`'s "Finalized contract (2026-07-17 10:00)"
 * entry for the full round-trip contract.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const { message } = body;
    if (typeof message !== "string" || message.trim().length === 0) {
      return apiError(400, "message must be a non-empty string");
    }

    const agent = await agentsTable().findOne({ where: { _id: id } });
    if (!agent) {
      return apiError(404, `No agent with id ${id}`);
    }

    if (agent.status !== "active") {
      return apiError(
        409,
        `Agent is ${agent.status}, cannot send it a message. Reactivate it first via PATCH /api/agents/:id.`,
      );
    }

    const command = await commandQueueTable().create({ agent_id: id, instruction: message });
    return apiOk({ command_id: command._id, status: command.status });
  });
}
