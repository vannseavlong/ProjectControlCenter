import { defineTable, string, date, boolean } from "longcelot-sheet-db";

export default defineTable({
  name: "projects",
  actor: "admin",
  timestamps: true,
  columns: {
    project_name: string().required().unique(),
    type: string().enum(["frontend", "backend"]).required(),
    platform: string().enum(["vercel", "render"]).required(),
    repo_url: string(),
    render_service_id: string(),
    vercel_project_id: string(),
    url: string(),
    thumbnail_url: string(),
    status: string().enum(["up", "down", "sleeping", "unknown"]).default("unknown"),
    last_checked: date(),
    notes: string(),
    // User-managed bookkeeping field (not auto-detected) — tracks whether the admin has
    // implemented a /health route for this project yet. Defaults to true so
    // existing/legacy rows created before this column don't retroactively read as
    // "missing" until the user actually reviews them. Purely informational — unrelated to
    // `status`/`last_checked`, which reflect the last actual ping result, and doesn't feed
    // into pingHealth's own /health-then-bare-url fallback logic.
    has_health_endpoint: boolean().default(true),
  },
});
