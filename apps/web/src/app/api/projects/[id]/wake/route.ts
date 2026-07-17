import { pingLogsTable, projectsTable } from "@pcc/db";
import type { PingStatus, ProjectStatus } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
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
    const pingStatus: PingStatus = result.ok ? "success" : result.timedOut ? "timeout" : "error";
    const projectStatus: ProjectStatus = result.ok ? "up" : result.timedOut ? "sleeping" : "down";
    const last_checked = new Date().toISOString();

    // See apps/web/src/app/api/projects/[id]/health/route.ts for why this is conditional — a
    // timed-out final attempt (healthEndpointDetected === null) leaves has_health_endpoint alone.
    const healthEndpointUpdate =
      result.healthEndpointDetected !== null ? { has_health_endpoint: result.healthEndpointDetected } : {};

    await pingLogsTable().create({
      project_id: project._id,
      status: pingStatus,
      response_time_ms: result.responseTimeMs,
    });
    await projectsTable().update({
      where: { _id: project._id },
      data: { status: projectStatus, last_checked, ...healthEndpointUpdate },
    });

    return apiOk({
      project: { ...project, status: projectStatus, last_checked, ...healthEndpointUpdate },
      wake: result,
    });
  });
}
