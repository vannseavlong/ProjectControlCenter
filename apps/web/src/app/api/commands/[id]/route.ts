import { commandQueueTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

/**
 * Read-back endpoint for a `command_queue` row created via `POST /api/agents/:id/message`.
 * Frontend polls this until `status` is `"done"`/`"failed"`, then renders `result`. See
 * `Tasks/agent-chat.md`'s "Finalized contract (2026-07-17 10:00)" entry for the full contract.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const command = await commandQueueTable().findOne({ where: { _id: id } });
    if (!command) {
      return apiError(404, `No command with id ${id}`);
    }

    return apiOk({ command });
  });
}
