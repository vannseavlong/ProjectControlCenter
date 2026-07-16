import { pingLogsTable, projectsTable } from "@pcc/db";
import type { PingStatus, Project, ProjectStatus } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { pingHealth } from "@/lib/render";

/** Give the ping loop over every backend project room to run past the default 10s serverless limit (Vercel Pro+; ignored on Hobby). */
export const maxDuration = 60;

/**
 * Cron decision (plan §10): Render's free-tier sleep timeout (~15min) rules out Vercel Cron on
 * the Hobby plan, which only supports daily triggers — a daily ping does nothing to keep a
 * service warm. Resolved by keeping this route scheduler-agnostic: it authenticates via a
 * shared `CRON_SECRET` bearer token, so either a Vercel Cron job (Pro plan, minute-level
 * schedules) or the scheduled GitHub Actions workflow at .github/workflows/health-check-cron.yml
 * (the default for Hobby-tier deployments) can trigger it the same way.
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return apiError(401, "Unauthorized");
      }
    }

    const backendProjects = await projectsTable().findMany({ where: { type: "backend" } });
    const results: Array<{ project_id: string; status: ProjectStatus }> = [];

    // Sequential, not Promise.all — avoids bursting concurrent writes at Sheets' 60 reads/min
    // quota (plan §11) when the project roster grows past a handful of rows.
    for (const project of backendProjects) {
      const status = await checkProject(project);
      if (status) results.push(status);
    }

    return apiOk({ checked: results.length, results });
  });
}

async function checkProject(project: Project): Promise<{ project_id: string; status: ProjectStatus } | null> {
  if (!project.url) return null;

  const result = await pingHealth(project.url);
  const pingStatus: PingStatus = result.ok ? "success" : result.timedOut ? "timeout" : "error";
  const status: ProjectStatus = result.ok ? "up" : result.timedOut ? "sleeping" : "down";
  const last_checked = new Date().toISOString();

  // Opportunistically keeps has_health_endpoint accurate on every scheduled run, same rule as the
  // manual health/wake routes — see apps/web/src/app/api/projects/[id]/health/route.ts. This is
  // what makes the field self-correcting over time even if nobody ever revisits a given project:
  // add a `/health` route later, and the next cron pass picks it up automatically.
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

  return { project_id: project._id, status };
}
