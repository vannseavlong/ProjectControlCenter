import { projectsTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

/**
 * Persists a drag-and-drop order. Body: `{ ids: string[] }` — the full desired order of the
 * projects being reordered (in practice every project of one `type`); each id's index becomes its
 * `sort_order`. Only rows whose `sort_order` actually changes get written, and writes stay
 * sequential — same Sheets quota rule as the cron health-check and wake-all routes.
 */
export async function PUT(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && id.length > 0)) {
      return apiError(400, "ids must be a non-empty array of project ids");
    }
    if (new Set(ids).size !== ids.length) {
      return apiError(400, "ids must not contain duplicates");
    }

    const projects = await projectsTable().findMany();
    const byId = new Map(projects.map((p) => [p._id, p]));
    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
      return apiError(404, `No project with id ${unknown.join(", ")}`);
    }

    let updated = 0;
    for (const [index, id] of (ids as string[]).entries()) {
      if (byId.get(id)?.sort_order === index) continue;
      await projectsTable().update({ where: { _id: id }, data: { sort_order: index } });
      updated++;
    }

    return apiOk({ updated });
  });
}
