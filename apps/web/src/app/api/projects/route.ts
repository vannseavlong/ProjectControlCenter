import { projectsTable } from "@pcc/db";
import type { ProjectPlatform, ProjectType } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

const PROJECT_TYPES: ProjectType[] = ["frontend", "backend"];
const PROJECT_PLATFORMS: ProjectPlatform[] = ["vercel", "render"];

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

    const { project_name, type, platform, repo_url, render_service_id, vercel_project_id, url, notes } = body;

    if (typeof project_name !== "string" || project_name.trim().length === 0) {
      return apiError(400, "project_name is required");
    }
    if (typeof type !== "string" || !PROJECT_TYPES.includes(type as ProjectType)) {
      return apiError(400, `type must be one of: ${PROJECT_TYPES.join(", ")}`);
    }
    if (typeof platform !== "string" || !PROJECT_PLATFORMS.includes(platform as ProjectPlatform)) {
      return apiError(400, `platform must be one of: ${PROJECT_PLATFORMS.join(", ")}`);
    }

    const project = await projectsTable().create({
      project_name,
      type: type as ProjectType,
      platform: platform as ProjectPlatform,
      repo_url: typeof repo_url === "string" ? repo_url : undefined,
      render_service_id: typeof render_service_id === "string" ? render_service_id : undefined,
      vercel_project_id: typeof vercel_project_id === "string" ? vercel_project_id : undefined,
      url: typeof url === "string" ? url : undefined,
      notes: typeof notes === "string" ? notes : undefined,
      status: "unknown",
    });

    return apiOk({ project }, 201);
  });
}
