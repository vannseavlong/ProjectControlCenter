import { agentsTable } from "@pcc/db";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

export async function GET() {
  return withApiErrorHandling(async () => {
    const agents = await agentsTable().findMany({ orderBy: "agent_name", order: "asc" });
    return apiOk({ agents });
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const { agent_name, assigned_project_id, local_project_path, brief } = body;

    if (typeof agent_name !== "string" || agent_name.trim().length === 0) {
      return apiError(400, "agent_name is required");
    }
    if (typeof assigned_project_id !== "string" || assigned_project_id.trim().length === 0) {
      return apiError(400, "assigned_project_id is required");
    }
    if (typeof local_project_path !== "string" || local_project_path.trim().length === 0) {
      return apiError(400, "local_project_path is required");
    }

    const agent = await agentsTable().create({
      agent_name,
      assigned_project_id,
      local_project_path,
      brief: typeof brief === "string" ? brief : undefined,
      status: "active",
    });

    return apiOk({ agent }, 201);
  });
}
