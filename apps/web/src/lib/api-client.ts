import type { Agent, AgentStatus, PingLog, Project, ProjectPlatform, ProjectType } from "@pcc/types";
import type { PingResult, WakeResult } from "@/lib/render";
import type { VercelDeploymentStatus } from "@/lib/vercel";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request to ${input} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface CreateProjectInput {
  project_name: string;
  type: ProjectType;
  platform: ProjectPlatform;
  repo_url?: string;
  render_service_id?: string;
  vercel_project_id?: string;
  url?: string;
  notes?: string;
}

export interface CreateAgentInput {
  agent_name: string;
  assigned_project_id: string;
  local_project_path: string;
  brief?: string;
}

export const api = {
  projects: {
    list: () => fetchJson<{ projects: Project[] }>("/api/projects").then((r) => r.projects),
    create: (input: CreateProjectInput) =>
      fetchJson<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify(input) }).then(
        (r) => r.project,
      ),
    health: (id: string) => fetchJson<{ project: Project; ping: PingResult }>(`/api/projects/${id}/health`),
    wake: (id: string) => fetchJson<{ project: Project; wake: WakeResult }>(`/api/projects/${id}/wake`, { method: "POST" }),
    deployStatus: (id: string) =>
      fetchJson<{ deployment: VercelDeploymentStatus | null }>(`/api/projects/${id}/deploy-status`).then(
        (r) => r.deployment,
      ),
  },
  agents: {
    list: () => fetchJson<{ agents: Agent[] }>("/api/agents").then((r) => r.agents),
    create: (input: CreateAgentInput) =>
      fetchJson<{ agent: Agent }>("/api/agents", { method: "POST", body: JSON.stringify(input) }).then((r) => r.agent),
    updateStatus: (id: string, status: AgentStatus) =>
      fetchJson<{ agent: Agent }>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).then(
        (r) => r.agent,
      ),
    remove: (id: string) => fetchJson<{ deleted: true; id: string }>(`/api/agents/${id}`, { method: "DELETE" }),
    /** Still the 501 stub server-side (blocked on agent-bridge) — wired up so the Voice Console only needs a swap once it's real. */
    sendMessage: (id: string, message: string) =>
      fetchJson<{ reply: string }>(`/api/agents/${id}/message`, { method: "POST", body: JSON.stringify({ message }) }),
  },
  pingLogs: {
    list: () => fetchJson<{ pingLogs: PingLog[] }>("/api/ping-logs").then((r) => r.pingLogs),
  },
};
