import type { SheetDBConfig } from "longcelot-sheet-db";

const config: SheetDBConfig = {
  projectName: "project-control-center",
  superAdminEmail: "you@example.com", // TODO: set to the Google account that owns ADMIN_SHEET_ID
  actors: [{ name: "admin", sheetIdEnv: "ADMIN_SHEET_ID" }],
  onSchemaMismatch: "warn",
  schemasDir: "schemas",
};

export default config;
