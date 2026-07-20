import { projectsTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { recordPingResult } from "@/lib/ping-record";
import { wakeService } from "@/lib/render";

/** Give the poll loop in wakeService room to run past the default 10s serverless limit (Vercel Pro+; ignored on Hobby). */
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const project = await projectsTable().findOne({ where: { _id: id } });
    if (!project) {
      return apiError(404, `No project with id ${id}`);
    }
    if (project.platform !== "render") {
      return apiError(400, `Project ${id} is not a Render service`);
    }
    if (!project.url) {
      return apiError(400, `Project ${id} has no url to wake`);
    }

    const result = await wakeService(project.url);
    const { project: updatedProject } = await recordPingResult(project, result);

    return apiOk({ project: updatedProject, wake: result });
  });
}
