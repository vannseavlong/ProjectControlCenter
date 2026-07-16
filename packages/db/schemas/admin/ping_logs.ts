import { defineTable, string, number } from "longcelot-sheet-db";

export default defineTable({
  name: "ping_logs",
  actor: "admin",
  timestamps: true,
  columns: {
    project_id: string().ref("projects._id").required(),
    status: string().enum(["success", "timeout", "error"]).required(),
    response_time_ms: number(),
  },
});
