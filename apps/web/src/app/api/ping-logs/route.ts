import { pingLogsTable } from "@pcc/db";
import { apiOk, withApiErrorHandling } from "@/lib/api-response";

/** Backs the Dashboard's recent-activity feed — most recent pings across all projects, newest first. */
export async function GET() {
  return withApiErrorHandling(async () => {
    const pingLogs = await pingLogsTable().findMany({ orderBy: "_created_at", order: "desc", limit: 50 });
    return apiOk({ pingLogs });
  });
}
