import { getVercelApiToken } from "./env";

const VERCEL_API_BASE = "https://api.vercel.com";

export type VercelReadyState =
  | "QUEUED"
  | "BUILDING"
  | "INITIALIZING"
  | "READY"
  | "ERROR"
  | "CANCELED";

export interface VercelDeploymentStatus {
  id: string;
  url: string;
  readyState: VercelReadyState;
  createdAt: string;
}

/** Latest deployment for a Vercel project — the source of truth for the Frontend Sites grid's live/down badge. */
export async function getLatestDeployment(vercelProjectId: string): Promise<VercelDeploymentStatus | null> {
  const params = new URLSearchParams({ projectId: vercelProjectId, limit: "1" });
  const res = await fetch(`${VERCEL_API_BASE}/v6/deployments?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${getVercelApiToken()}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Vercel API error (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { deployments?: Array<Record<string, unknown>> };
  const deployment = body.deployments?.[0];
  if (!deployment) return null;

  return {
    id: String(deployment.uid ?? ""),
    url: String(deployment.url ?? ""),
    readyState: (deployment.readyState as VercelReadyState) ?? "QUEUED",
    createdAt: new Date(Number(deployment.createdAt ?? 0)).toISOString(),
  };
}
