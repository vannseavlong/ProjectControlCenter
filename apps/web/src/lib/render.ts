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

interface FetchResult {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  timedOut: boolean;
}

export interface PingResult extends FetchResult {
  /**
   * Whether the dedicated `/health` route itself answered — distinct from `ok`, which also
   * counts a successful bare-`baseUrl` fallback. `true` if `/health` returned 2xx, `false` if it
   * completed with a real non-2xx response (e.g. a plain 404 — the route just doesn't exist),
   * `null` if the `/health` request timed out (inconclusive: the service may simply be asleep,
   * this says nothing about whether the route exists).
   */
  healthEndpointDetected: boolean | null;
}

async function fetchOnce(url: string, timeoutMs: number): Promise<FetchResult> {
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

/** Dedicated health-route paths to try, in order, before falling back to the bare `baseUrl`. */
const HEALTH_PATHS = ["/health", "/api/health"];

/**
 * Pings a deployed service's own health route (not the Render management API). Free-tier
 * Render services cold-start on any inbound request, so this same call doubles as the wake
 * trigger — there's no separate "wake" endpoint on Render's API.
 *
 * Not every tracked service exposes a health route at the same path — some projects use `/health`,
 * others `/api/health` — so both are tried in turn. If none of them return 2xx (e.g. a plain 404,
 * meaning the route just doesn't exist), fall back to the bare `baseUrl` before concluding the
 * service is down, since a service can be genuinely up and serving traffic without a dedicated
 * health route. Skip further attempts on a timeout, though: that already means the service is
 * slow/asleep, and retrying the same cold service against a different path would just double the
 * wait without telling us anything new.
 */
export async function pingHealth(baseUrl: string, timeoutMs = 10_000): Promise<PingResult> {
  let last: FetchResult | null = null;
  for (const path of HEALTH_PATHS) {
    const result = await fetchOnce(new URL(path, baseUrl).toString(), timeoutMs);
    if (result.ok) return { ...result, healthEndpointDetected: true };
    if (result.timedOut) return { ...result, healthEndpointDetected: null };
    last = result;
  }

  const fallback = await fetchOnce(baseUrl, timeoutMs);
  return { ...(fallback.ok ? fallback : last!), healthEndpointDetected: false };
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
  let last: PingResult = { ok: false, statusCode: null, responseTimeMs: 0, timedOut: false, healthEndpointDetected: null };

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
