import type { Agent, AgentStatus, Command, PingLog, Project, ProjectPlatform, ProjectType } from "@pcc/types";
import type { PingResult, WakeResult } from "@/lib/render";
import type { VercelDeploymentStatus } from "@/lib/vercel";
import type { ReachabilityResult } from "@/lib/reachability";

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
  has_health_endpoint?: boolean;
}

/** Partial update — only fields present are applied; matches `PATCH /api/projects/[id]`'s "present in body" semantics exactly. */
export type UpdateProjectInput = Partial<CreateProjectInput>;

/** Wire shape returned by `GET /api/projects/:id/deploy-status` — `deployment`/`reachability` are mutually exclusive, see that route. */
export interface DeployStatusResult {
  deployment: VercelDeploymentStatus | null;
  reachability: ReachabilityResult | null;
}

/** Wire shape returned by `POST /api/projects/wake-all` — one entry per Render-backed backend project with a url. */
export interface WakeAllResult {
  total: number;
  woken: number;
  results: Array<{ project_id: string; project_name: string; wake: WakeResult }>;
}

export interface CreateAgentInput {
  agent_name: string;
  assigned_project_id: string;
  local_project_path: string;
  brief?: string;
  voice_uri?: string;
  voice_name?: string;
}

/** Body shape for `PATCH /api/agents/:id`'s voice-only update — see `updateVoice` below. */
export interface UpdateAgentVoiceInput {
  voice_uri?: string;
  voice_name?: string;
}

/** Staffing-edit partial update — only fields present are applied, same "present in body" semantics as `PATCH /api/agents/:id`. */
export interface UpdateAgentInput {
  agent_name?: string;
  assigned_project_id?: string;
  local_project_path?: string;
  brief?: string;
}

export interface SaveSettingInput {
  key: string;
  value?: string;
  secret?: boolean;
}

/**
 * Wire shape returned by `GET/POST /api/settings` — deliberately not `SettingRow` from `@pcc/types`
 * (that's the raw table row). The route masks secret rows to `{ secret: true, configured }` and
 * never sends a saved secret's real value back to the client — see `maskSetting` in
 * `apps/web/src/app/api/settings/route.ts`.
 */
export interface SettingSummary {
  _id: string;
  key: string;
  secret: boolean;
  /** Present (and the source of truth) only when `secret: true`. */
  configured?: boolean;
  /** Present only when `secret: false` — secret values are never echoed back. */
  value?: string;
  _created_at: string;
  _updated_at: string;
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
    /** Wakes every Render-backed backend project in one call — see `POST /api/projects/wake-all`. */
    wakeAll: () => fetchJson<WakeAllResult>("/api/projects/wake-all", { method: "POST" }),
    /**
     * `reachability` is only populated as a fallback for non-Vercel-hosted projects (or a Vercel
     * project missing its `vercel_project_id`) — see `GET /api/projects/:id/deploy-status`. Both
     * fields returned as-is (not narrowed to just `deployment`) so callers can combine them via
     * `projectLiveTone` in `lib/format.ts`.
     */
    deployStatus: (id: string) =>
      fetchJson<DeployStatusResult>(`/api/projects/${id}/deploy-status`),
    /** Persists a drag-and-drop order — `ids` in their new display order, see `PUT /api/projects/reorder`. */
    reorder: (ids: string[]) =>
      fetchJson<{ updated: number }>("/api/projects/reorder", { method: "PUT", body: JSON.stringify({ ids }) }),
    update: (id: string, input: UpdateProjectInput) =>
      fetchJson<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }).then(
        (r) => r.project,
      ),
    /**
     * Hard delete — 404s if missing, 409s if a non-fired agent is still assigned (message names
     * the blocking agents). Response shape has an extra `cascadedPingLogs` count beyond the plain
     * `{ deleted: true, id }` `DELETE /api/agents/:id` returns, since this route also cascades
     * `ping_logs` rows for the project — see `apps/web/src/app/api/projects/[id]/route.ts`.
     */
    remove: (id: string) =>
      fetchJson<{ deleted: true; id: string; cascadedPingLogs: number }>(`/api/projects/${id}`, { method: "DELETE" }),
    /**
     * On-demand SEO scoring — Tasks/app-backend.md §5. No request body. Re-fetched, full `Project`
     * returned on success (same convention as `update`); 400 if the project has no `url`, 502 if
     * the homepage was unreachable (existing seo_* data left untouched in that case) — both surface
     * `error` verbatim via the mutation's `onError`, see `useAnalyzeSeo`.
     */
    analyzeSeo: (id: string) =>
      fetchJson<{ project: Project }>(`/api/projects/${id}/analyze-seo`, { method: "POST" }).then((r) => r.project),
  },
  agents: {
    list: () => fetchJson<{ agents: Agent[] }>("/api/agents").then((r) => r.agents),
    create: (input: CreateAgentInput) =>
      fetchJson<{ agent: Agent }>("/api/agents", { method: "POST", body: JSON.stringify(input) }).then((r) => r.agent),
    updateStatus: (id: string, status: AgentStatus) =>
      fetchJson<{ agent: Agent }>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).then(
        (r) => r.agent,
      ),
    /** Voice-only partial update — omitted fields are left untouched, same "present in body" semantics as `PATCH /api/agents/:id`. */
    updateVoice: (id: string, input: UpdateAgentVoiceInput) =>
      fetchJson<{ agent: Agent }>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(input) }).then(
        (r) => r.agent,
      ),
    /** Staffing edit (name/project/path/brief) — omitted fields are left untouched. */
    update: (id: string, input: UpdateAgentInput) =>
      fetchJson<{ agent: Agent }>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(input) }).then(
        (r) => r.agent,
      ),
    remove: (id: string) => fetchJson<{ deleted: true; id: string }>(`/api/agents/${id}`, { method: "DELETE" }),
    /**
     * Queues a `command_queue` row and returns immediately — the agent-bridge daemon shells out
     * to Claude Code out-of-band and can take up to `AGENT_BRIDGE_COMMAND_TIMEOUT_MS` (10 min
     * default) to actually resolve it, so this no longer returns a synchronous reply. Poll
     * `api.commands.get(command_id)` until its `status` is terminal — see `useCommandPoll`.
     * 404s if the agent is missing, 409s if `agent.status !== "active"`.
     */
    sendMessage: (id: string, message: string) =>
      fetchJson<{ command_id: string; status: string }>(`/api/agents/${id}/message`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
  },
  commands: {
    /** 404s if the command doesn't exist. */
    get: (id: string) => fetchJson<{ command: Command }>(`/api/commands/${id}`),
  },
  pingLogs: {
    list: () => fetchJson<{ pingLogs: PingLog[] }>("/api/ping-logs").then((r) => r.pingLogs),
  },
  settings: {
    list: () => fetchJson<{ settings: SettingSummary[] }>("/api/settings").then((r) => r.settings),
    /** Upserts one or more key/value pairs in one call — mirrors the route's `{ settings: [...] }` batch body. */
    save: (inputs: SaveSettingInput[]) =>
      fetchJson<{ settings: SettingSummary[] }>("/api/settings", {
        method: "POST",
        body: JSON.stringify({ settings: inputs }),
      }).then((r) => r.settings),
  },
};
