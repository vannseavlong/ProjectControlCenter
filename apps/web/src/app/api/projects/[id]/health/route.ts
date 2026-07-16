import { pingLogsTable, projectsTable } from "@pcc/db";
import type { PingStatus, ProjectStatus } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
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
    const pingStatus: PingStatus = result.ok ? "success" : result.timedOut ? "timeout" : "error";
    const projectStatus: ProjectStatus = result.ok ? "up" : result.timedOut ? "sleeping" : "down";
    const last_checked = new Date().toISOString();

    await pingLogsTable().create({
      project_id: project._id,
      status: pingStatus,
      response_time_ms: result.responseTimeMs,
    });
    await projectsTable().update({
      where: { _id: project._id },
      data: { status: projectStatus, last_checked },
    });

    return apiOk({
      project: { ...project, status: projectStatus, last_checked },
      ping: result,
    });
  });
}
