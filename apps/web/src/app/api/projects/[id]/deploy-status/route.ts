import { projectsTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { getLatestDeployment } from "@/lib/vercel";

/**
 * Kept separate from GET /api/projects rather than folded in — the dashboard polls the projects
 * list far more often than any single project's deploy status needs to change, and a live
 * Vercel API call per project on every list read would be slow and quota-hungry (task app-backend.md §3).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const project = await projectsTable().findOne({ where: { _id: id } });
    if (!project) {
      return apiError(404, `No project with id ${id}`);
    }
    if (project.platform !== "vercel") {
      return apiError(400, `Project ${id} is not a Vercel project`);
    }
    if (!project.vercel_project_id) {
      return apiError(400, `Project ${id} has no vercel_project_id configured`);
    }

    const deployment = await getLatestDeployment(project.vercel_project_id);
    return apiOk({ deployment });
  });
}
