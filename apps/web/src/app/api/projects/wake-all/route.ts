import { projectsTable } from "@pcc/db";
import type { Project } from "@pcc/types";
import { apiOk, withApiErrorHandling } from "@/lib/api-response";
import { recordPingResult } from "@/lib/ping-record";
import { wakeService, type WakeResult } from "@/lib/render";

/** Same budget as the single-project wake route — see that route for why. */
export const maxDuration = 60;

export interface WakeAllResultEntry {
  project_id: string;
  project_name: string;
  wake: WakeResult;
}

export async function POST() {
  return withApiErrorHandling(async () => {
    const backendProjects = await projectsTable().findMany({ where: { type: "backend" } });
    const wakeable = backendProjects.filter(
      (p): p is Project & { url: string } => p.platform === "render" && Boolean(p.url),
    );

    // Each wake polls a different Render URL, not Sheets, so running them concurrently is safe —
    // only the resulting Sheets writes below need to stay sequential, same 60 reads/min quota
    // rule as the cron health-check route.
    const wakes = await Promise.all(
      wakeable.map(async (project) => ({ project, wake: await wakeService(project.url) })),
    );

    const results: WakeAllResultEntry[] = [];
    for (const { project, wake } of wakes) {
      await recordPingResult(project, wake);
      results.push({ project_id: project._id, project_name: project.project_name, wake });
    }

    return apiOk({
      total: results.length,
      woken: results.filter((r) => r.wake.ok).length,
      results,
    });
  });
}
