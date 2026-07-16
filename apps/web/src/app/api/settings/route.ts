import { settingsTable } from "@pcc/db";
import type { SettingRow } from "@pcc/types";
import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";

interface SettingInput {
  key: string;
  value?: string;
  secret?: boolean;
}

/** Generic key/value settings API — no hardcoded key list here, callers decide which keys they read/write. */

function parseSettingInput(raw: unknown): SettingInput | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const { key, value, secret } = raw as Record<string, unknown>;
  if (typeof key !== "string" || key.trim().length === 0) {
    return null;
  }
  if (value !== undefined && typeof value !== "string") {
    return null;
  }
  if (secret !== undefined && typeof secret !== "boolean") {
    return null;
  }
  return {
    key,
    value: typeof value === "string" ? value : undefined,
    secret: typeof secret === "boolean" ? secret : undefined,
  };
}

/**
 * Never leak a secret's raw value back to the client once saved — rows with `secret: true` are
 * returned as `{ configured: boolean }` instead of `{ value }`.
 */
function maskSetting(row: SettingRow) {
  if (row.secret) {
    return {
      _id: row._id,
      key: row.key,
      secret: true as const,
      configured: Boolean(row.value),
      _created_at: row._created_at,
      _updated_at: row._updated_at,
    };
  }
  return {
    _id: row._id,
    key: row.key,
    secret: false as const,
    value: row.value,
    _created_at: row._created_at,
    _updated_at: row._updated_at,
  };
}

export async function GET() {
  return withApiErrorHandling(async () => {
    const rows = await settingsTable().findMany({ orderBy: "key", order: "asc" });
    return apiOk({ settings: rows.map(maskSetting) });
  });
}

/** Upserts one or more key/value pairs. Body is either a single `{ key, value?, secret? }` or `{ settings: [...] }`. */
export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const rawInputs = Array.isArray(body.settings) ? body.settings : [body];
    if (rawInputs.length === 0) {
      return apiError(400, "At least one setting is required");
    }

    const inputs: SettingInput[] = [];
    for (const raw of rawInputs) {
      const parsed = parseSettingInput(raw);
      if (!parsed) {
        return apiError(
          400,
          "Each setting must have a string `key`, and optional string `value` / boolean `secret`",
        );
      }
      inputs.push(parsed);
    }

    const results: SettingRow[] = [];
    for (const input of inputs) {
      const data: Record<string, unknown> = { key: input.key };
      if (input.value !== undefined) {
        data.value = input.value;
      }
      if (input.secret !== undefined) {
        data.secret = input.secret;
      }
      const row = await settingsTable().upsert({ where: { key: input.key }, data });
      results.push(row);
    }

    return apiOk({ settings: results.map(maskSetting) });
  });
}
