import type { WithTimestamps } from "./common";

export type AgentStatus = "active" | "paused" | "fired";

export interface Agent extends WithTimestamps {
  agent_name: string;
  assigned_project_id: string;
  local_project_path: string;
  brief?: string;
  status: AgentStatus;
  last_active?: string;
}
