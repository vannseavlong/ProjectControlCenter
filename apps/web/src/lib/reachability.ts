export interface ReachabilityResult {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  timedOut: boolean;
}

/**
 * Pings a bare URL directly — no `/health` assumption, unlike `pingHealth` in `./render.ts`.
 * That helper is Render-specific (it knows about Render's cold-start behavior and has a
 * `/health`-then-bare-`url` fallback); this one is the platform-agnostic live/down signal for
 * frontend hosting that isn't Vercel (Firebase Hosting, Netlify, GitHub Pages, a custom server —
 * see Tasks/app-backend.md §3), where a dedicated health route generally doesn't exist at all.
 */
export async function pingUrl(url: string, timeoutMs = 10_000): Promise<ReachabilityResult> {
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
