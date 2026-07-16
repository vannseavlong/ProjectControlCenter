import { defineTable, string, date } from "longcelot-sheet-db";

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
  },
});
