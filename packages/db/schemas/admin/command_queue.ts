import { defineTable, string } from "longcelot-sheet-db";

// Only needed for the local-bridge-daemon approach (plan §4.4) — holds pending
// instructions per agent until apps/agent-bridge polls and picks them up.
export default defineTable({
  name: "command_queue",
  actor: "admin",
  timestamps: true,
  columns: {
    agent_id: string().ref("agents._id").required(),
    instruction: string().required(),
    status: string().enum(["pending", "in_progress", "done", "failed"]).default("pending"),
    result: string(),
  },
});
