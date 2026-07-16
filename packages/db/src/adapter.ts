import { createSheetAdapter, type SheetAdapter } from "longcelot-sheet-db";
import projectsSchema from "../schemas/admin/projects";
import agentsSchema from "../schemas/admin/agents";
import pingLogsSchema from "../schemas/admin/ping_logs";
import commandQueueSchema from "../schemas/admin/command_queue";

let adapter: SheetAdapter | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildAdapter(): SheetAdapter {
  const instance = createSheetAdapter({
    adminSheetId: requireEnv("ADMIN_SHEET_ID"),
    credentials: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
    },
    // TODO(Phase 1): load stored OAuth tokens for the admin actor instead of undefined.
    tokens: undefined,
  });

  instance.registerSchemas([projectsSchema, agentsSchema, pingLogsSchema, commandQueueSchema]);

  return instance;
}

/** Lazily-built process-wide adapter singleton. Never call `createSheetAdapter` outside this file. */
export function getAdapter(): SheetAdapter {
  if (!adapter) {
    adapter = buildAdapter();
  }
  return adapter;
}

/** Sheet-DB context bound to the single `admin` actor this portal uses. */
export function getAdminContext(): SheetAdapter {
  return getAdapter().withContext({
    userId: "admin",
    actor: "admin",
    actorSheetId: requireEnv("ADMIN_SHEET_ID"),
  });
}
