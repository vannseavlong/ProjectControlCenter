import { getRenderApiKey } from "./env";

const RENDER_API_BASE = "https://api.render.com/v1";

export interface RenderServiceStatus {
  id: string;
  name: string;
  suspended: "suspended" | "not_suspended";
  updatedAt: string;
}

/** GET service metadata from Render's management API — does not tell you if a free-tier service is currently asleep. */
export async function getRenderServiceStatus(serviceId: string): Promise<RenderServiceStatus> {
  const res = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
    headers: {
      Authorization: `Bearer ${getRenderApiKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Render API error (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  return {
    id: String(body.id ?? serviceId),
    name: String(body.name ?? ""),
    suspended: body.suspended === "suspended" ? "suspended" : "not_suspended",
    updatedAt: String(body.updatedAt ?? ""),
  };
}

export interface PingResult {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  timedOut: boolean;
}

/**
 * Pings a deployed service's own `/health` route (not the Render management API). Free-tier
 * Render services cold-start on any inbound request, so this same call doubles as the wake
 * trigger — there's no separate "wake" endpoint on Render's API.
 */
export async function pingHealth(baseUrl: string, timeoutMs = 10_000): Promise<PingResult> {
  const url = new URL("/health", baseUrl).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return { ok: res.ok, statusCode: res.status, responseTimeMs: Date.now() - start, timedOut: false };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return { ok: false, statusCode: null, responseTimeMs: Date.now() - start, timedOut };
  } finally {
    clearTimeout(timeout);
  }
}

export interface WakeResult extends PingResult {
  attempts: number;
}

export interface WakeOptions {
  /** Total time budget across all poll attempts, in ms. Default 45s — stays under typical serverless function limits. */
  totalBudgetMs?: number;
  intervalMs?: number;
  requestTimeoutMs?: number;
}

/** Polls a sleeping Render free-tier service until it returns 200 or the overall time budget runs out. */
export async function wakeService(baseUrl: string, options: WakeOptions = {}): Promise<WakeResult> {
  const totalBudgetMs = options.totalBudgetMs ?? 45_000;
  const intervalMs = options.intervalMs ?? 3_000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  const deadline = Date.now() + totalBudgetMs;

  let attempts = 0;
  let last: PingResult = { ok: false, statusCode: null, responseTimeMs: 0, timedOut: false };

  while (Date.now() < deadline) {
    attempts += 1;
    last = await pingHealth(baseUrl, requestTimeoutMs);
    if (last.ok) {
      return { ...last, attempts };
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }

  return { ...last, attempts };
}
