import { projectsTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { EnvValidationError } from "@/lib/env";
import { getLatestDeployment } from "@/lib/vercel";
import { pingUrl } from "@/lib/reachability";

/**
 * Kept separate from GET /api/projects rather than folded in — the dashboard polls the projects
 * list far more often than any single project's deploy status needs to change, and a live
 * Vercel API call per project on every list read would be slow and quota-hungry (task app-backend.md §3).
 *
 * Vercel's `readyState` only exists for Vercel-hosted projects with a `vercel_project_id` — for
 * everything else (platform `"other"`, or a Vercel project missing its ID) there's no deploy API
 * to call, so this falls back to `pingUrl()` against the bare `url` instead (task app-backend.md
 * §3). Deliberately fallback-only, never combined with Vercel's readyState for projects that do
 * have Vercel data: reconciling two live signals (what wins if Vercel says READY but the URL ping
 * times out right after a deploy, e.g. DNS/CDN propagation lag?) adds real complexity for a case
 * that already works correctly today.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const project = await projectsTable().findOne({ where: { _id: id } });
    if (!project) {
      return apiError(404, `No project with id ${id}`);
    }

    if (project.platform === "vercel" && project.vercel_project_id) {
      try {
        const deployment = await getLatestDeployment(project.vercel_project_id);
        return apiOk({ deployment, reachability: null });
      } catch (err) {
        // A misconfigured token is worth surfacing loudly — anything else (bad/stale project ID,
        // a transient Vercel API error) falls through to the same bare-URL reachability check
        // used for platform "other", rather than leaving the project stuck on "Unknown".
        if (err instanceof EnvValidationError) throw err;
      }
    }

    if (!project.url) {
      return apiError(400, `Project ${id} has no url configured to check reachability against`);
    }
    const reachability = await pingUrl(project.url);
    return apiOk({ deployment: null, reachability });
  });
}
