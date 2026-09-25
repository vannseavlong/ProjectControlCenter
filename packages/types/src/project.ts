import type { WithTimestamps } from "./common";
import type { SeoCheckResult, SeoSegmentScores } from "./seo";

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
  // On-demand SEO scoring (Tasks/app-backend.md §5) — all four unset until
  // POST /api/projects/:id/analyze-seo has run at least once for this project.
  seo_score?: number;
  seo_segment_scores?: SeoSegmentScores;
  seo_report?: SeoCheckResult[];
  seo_last_analyzed?: string;
  /** Drag-and-drop display position, ascending within a `type` — unset until first reordered. */
  sort_order?: number;
}
