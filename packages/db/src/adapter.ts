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
    // Single-actor tool (plan §5) — a static refresh token is enough, no need for the pluggable
    // `tokenStore` (get/set per actorId) the adapter also supports. `googleapis`'s OAuth2 client
    // auto-refreshes the access token from just `refresh_token` on first use (see SheetClient's
    // `auth.setCredentials`), so nothing else needs to be stored.
    tokens: { refresh_token: requireEnv("ADMIN_OAUTH_REFRESH_TOKEN") },
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
