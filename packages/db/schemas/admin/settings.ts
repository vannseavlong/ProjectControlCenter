import { defineTable, string, boolean } from "longcelot-sheet-db";

export default defineTable({
  name: "settings",
  actor: "admin",
  timestamps: true,
  columns: {
    key: string().required().unique(),
    value: string(),
    secret: boolean().default(false),
  },
});
