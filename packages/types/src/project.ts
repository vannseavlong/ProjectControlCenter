import type { WithTimestamps } from "./common";

export type ProjectType = "frontend" | "backend";
export type ProjectPlatform = "vercel" | "render" | "other";
export type ProjectStatus = "up" | "down" | "sleeping" | "unknown";

export interface Project extends WithTimestamps {
  project_name: string;
  type: ProjectType;
  platform: ProjectPlatform;
  repo_url?: string;
  render_service_id?: string;
  vercel_project_id?: string;
  url?: string;
  thumbnail_url?: string;
  status: ProjectStatus;
  last_checked?: string;
  notes?: string;
  has_health_endpoint?: boolean;
}
