import { defineTable, string, date } from "longcelot-sheet-db";

export default defineTable({
  name: "agents",
  actor: "admin",
  timestamps: true,
  columns: {
    agent_name: string().required(),
    assigned_project_id: string().ref("projects._id").required(),
    local_project_path: string().required(),
    brief: string(),
    status: string().enum(["active", "paused", "fired"]).default("active"),
    last_active: date(),
  },
});
