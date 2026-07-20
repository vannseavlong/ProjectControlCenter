import { projectsTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { analyzeSeo } from "@/lib/seo-analyzer";

/**
 * On-demand SEO scoring for a single project — Tasks/app-backend.md §5. Re-runnable at any time;
 * each run fully overwrites the project's `seo_*` columns with the latest result.
 *
 * - 404 if the project doesn't exist.
 * - 400 if the project has no `url` to analyze.
 * - 502 if `analyzeSeo` throws (homepage unreachable/non-2xx/timeout) — deliberately does NOT
 *   persist a zero/failed score over whatever `seo_*` data the project already had, so a flaky
 *   scan can't clobber a real prior result.
 * - 200 `{ project }` (re-fetched, same convention as PATCH /api/projects/:id) on success.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;

    const existing = await projectsTable().findOne({ where: { _id: id } });
    if (!existing) {
      return apiError(404, `No project with id ${id}`);
    }

    if (!existing.url) {
      return apiError(400, "Project has no url to analyze");
    }

    let result: Awaited<ReturnType<typeof analyzeSeo>>;
    try {
      result = await analyzeSeo(existing.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return apiError(502, `Could not analyze SEO for ${existing.url}: ${message}`);
    }

    await projectsTable().update({
      where: { _id: id },
      data: {
        seo_score: result.score,
        seo_segment_scores: result.segmentScores,
        seo_report: result.report,
        seo_last_analyzed: new Date().toISOString(),
      },
    });

    const project = await projectsTable().findOne({ where: { _id: id } });
    return apiOk({ project });
  });
}
