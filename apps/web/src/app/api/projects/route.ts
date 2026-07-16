import { projectsTable } from "@pcc/db";
import type { ProjectPlatform, ProjectType } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { fetchOgImageUrl } from "@/lib/og-image";
import { pingHealth } from "@/lib/render";

/**
 * Shorter than pingHealth's own 10s default — this runs inline during project creation, and a
 * slow/cold service shouldn't make "Add project" feel hung. A shorter timeout just means more
 * cases fall back to inconclusive (`null`), which correctly leaves has_health_endpoint alone
 * rather than guessing — wake/cron/manual-check all still get the full timeout budget.
 */
const CREATE_PROBE_TIMEOUT_MS = 5_000;

const PROJECT_TYPES: ProjectType[] = ["frontend", "backend"];
const PROJECT_PLATFORMS: ProjectPlatform[] = ["vercel", "render", "other"];

export async function GET() {
  return withApiErrorHandling(async () => {
    const projects = await projectsTable().findMany({ orderBy: "project_name", order: "asc" });
    return apiOk({ projects });
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const {
      project_name,
      type,
      platform,
      repo_url,
      render_service_id,
      vercel_project_id,
      url,
      notes,
      has_health_endpoint,
    } = body;

    if (typeof project_name !== "string" || project_name.trim().length === 0) {
      return apiError(400, "project_name is required");
    }
    if (typeof type !== "string" || !PROJECT_TYPES.includes(type as ProjectType)) {
      return apiError(400, `type must be one of: ${PROJECT_TYPES.join(", ")}`);
    }
    if (typeof platform !== "string" || !PROJECT_PLATFORMS.includes(platform as ProjectPlatform)) {
      return apiError(400, `platform must be one of: ${PROJECT_PLATFORMS.join(", ")}`);
    }

    const urlProvided = typeof url === "string" && url.length > 0;

    // Best-effort: populate the thumbnail from the site's own og:image/twitter:image meta tag
    // (plan §10 screenshot-source decision, resolved in favor of this over a screenshot service —
    // see Tasks/app-backend.md §3) and, for backend services, probe whether `/health` actually
    // exists so has_health_endpoint doesn't have to be set by hand. Both run concurrently — two
    // independent fetches against the same url, no reason to serialize them. Neither throws:
    // fetchOgImageUrl resolves to null on any failure, pingHealth's healthEndpointDetected is
    // null (inconclusive) on a timeout — in both cases the corresponding field is simply left as
    // whatever was already supplied rather than guessed.
    const [thumbnailUrl, healthProbe] = await Promise.all([
      urlProvided ? fetchOgImageUrl(url) : Promise.resolve(null),
      urlProvided && type === "backend" ? pingHealth(url, CREATE_PROBE_TIMEOUT_MS) : Promise.resolve(null),
    ]);

    // A conclusive live probe beats whatever the add-project form's checkbox happened to submit —
    // the checkbox is a fallback for when we can't check for real, not a source of truth.
    const resolvedHasHealthEndpoint =
      healthProbe && healthProbe.healthEndpointDetected !== null
        ? healthProbe.healthEndpointDetected
        : typeof has_health_endpoint === "boolean"
          ? has_health_endpoint
          : undefined;

    const project = await projectsTable().create({
      project_name,
      type: type as ProjectType,
      platform: platform as ProjectPlatform,
      repo_url: typeof repo_url === "string" ? repo_url : undefined,
      render_service_id: typeof render_service_id === "string" ? render_service_id : undefined,
      vercel_project_id: typeof vercel_project_id === "string" ? vercel_project_id : undefined,
      url: typeof url === "string" ? url : undefined,
      notes: typeof notes === "string" ? notes : undefined,
      has_health_endpoint: resolvedHasHealthEndpoint,
      status: "unknown",
      ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
    });

    return apiOk({ project }, 201);
  });
}
