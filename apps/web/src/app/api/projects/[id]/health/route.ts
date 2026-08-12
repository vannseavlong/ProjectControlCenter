import { projectsTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { recordPingResult } from "@/lib/ping-record";
import { pingHealth } from "@/lib/render";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const project = await projectsTable().findOne({ where: { _id: id } });
    if (!project) {
      return apiError(404, `No project with id ${id}`);
    }
    if (!project.url) {
      return apiError(400, `Project ${id} has no url to ping`);
    }

    const result = await pingHealth(project.url);
    const { project: updatedProject } = await recordPingResult(project, result);

    return apiOk({ project: updatedProject, ping: result });
  });
}
