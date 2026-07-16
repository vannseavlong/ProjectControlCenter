import { projectsTable } from "@pcc/db";
import type { ProjectPlatform, ProjectType } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

const PROJECT_TYPES: ProjectType[] = ["frontend", "backend"];
const PROJECT_PLATFORMS: ProjectPlatform[] = ["vercel", "render"];

const STRING_FIELDS = ["repo_url", "render_service_id", "vercel_project_id", "url", "notes"] as const;

/** Partial update — only fields present in the request body are applied, everything else is left untouched. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const existing = await projectsTable().findOne({ where: { _id: id } });
    if (!existing) {
      return apiError(404, `No project with id ${id}`);
    }

    const data: Record<string, unknown> = {};

    if ("project_name" in body) {
      const { project_name } = body;
      if (typeof project_name !== "string" || project_name.trim().length === 0) {
        return apiError(400, "project_name must be a non-empty string");
      }
      data.project_name = project_name;
    }

    if ("type" in body) {
      const { type } = body;
      if (typeof type !== "string" || !PROJECT_TYPES.includes(type as ProjectType)) {
        return apiError(400, `type must be one of: ${PROJECT_TYPES.join(", ")}`);
      }
      data.type = type as ProjectType;
    }

    if ("platform" in body) {
      const { platform } = body;
      if (typeof platform !== "string" || !PROJECT_PLATFORMS.includes(platform as ProjectPlatform)) {
        return apiError(400, `platform must be one of: ${PROJECT_PLATFORMS.join(", ")}`);
      }
      data.platform = platform as ProjectPlatform;
    }

    for (const field of STRING_FIELDS) {
      if (field in body) {
        const value = body[field];
        if (typeof value !== "string") {
          return apiError(400, `${field} must be a string`);
        }
        data[field] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return apiError(400, "No editable fields present in request body");
    }

    await projectsTable().update({ where: { _id: id }, data });
    const project = await projectsTable().findOne({ where: { _id: id } });
    return apiOk({ project });
  });
}
