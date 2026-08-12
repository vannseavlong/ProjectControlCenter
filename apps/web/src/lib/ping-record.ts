import { pingLogsTable, projectsTable } from "@pcc/db";
import type { PingStatus, Project, ProjectStatus } from "@pcc/types";
import type { PingResult } from "./render";

export interface RecordedPing {
  project: Project;
  status: ProjectStatus;
}

/**
 * Turns a `PingResult`/`WakeResult` into stored state: writes a `ping_logs` row and updates the
 * project's `status`/`last_checked`/`has_health_endpoint`. Shared by the health, wake, wake-all,
 * and cron health-check routes so this mapping only lives in one place — see
 * `apps/web/src/lib/render.ts`'s `PingResult.healthEndpointDetected` for why a timed-out result
 * (`null`) leaves `has_health_endpoint` untouched instead of guessing `false`.
 */
export async function recordPingResult(project: Project, result: PingResult): Promise<RecordedPing> {
  const pingStatus: PingStatus = result.ok ? "success" : result.timedOut ? "timeout" : "error";
  const status: ProjectStatus = result.ok ? "up" : result.timedOut ? "sleeping" : "down";
  const last_checked = new Date().toISOString();
  const healthEndpointUpdate =
    result.healthEndpointDetected !== null ? { has_health_endpoint: result.healthEndpointDetected } : {};

  await pingLogsTable().create({
    project_id: project._id,
    status: pingStatus,
    response_time_ms: result.responseTimeMs,
  });
  await projectsTable().update({
    where: { _id: project._id },
    data: { status, last_checked, ...healthEndpointUpdate },
  });

  return { project: { ...project, status, last_checked, ...healthEndpointUpdate }, status };
}
