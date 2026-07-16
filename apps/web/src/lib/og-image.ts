const FETCH_TIMEOUT_MS = 5_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Matches `<meta ... property="og:image" ... content="..." ...>` regardless of attribute order. */
function extractMetaContent(html: string, attrName: "property" | "name", attrValue: string): string | null {
  // Two orderings: `content` before the attribute, or after — attribute order in the wild varies.
  const contentThenAttr = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${attrValue}["'][^>]*>`,
    "i",
  );
  const attrThenContent = new RegExp(
    `<meta[^>]*${attrName}=["']${attrValue}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(attrThenContent) ?? html.match(contentThenAttr);
  return match?.[1] ?? null;
}

/**
 * Best-effort scrape of a page's Open Graph (falling back to Twitter Card) image, used to
 * populate `projects.thumbnail_url` without standing up a screenshot service — see plan §10 /
 * `Tasks/app-backend.md` §3. Never throws: any network error, timeout, non-2xx response, or
 * missing meta tag resolves to `null` so a create/update request can't be broken by a flaky or
 * slow third-party site.
 */
export async function fetchOgImageUrl(pageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      return null;
    }
    const html = await res.text();
    const image =
      extractMetaContent(html, "property", "og:image") ?? extractMetaContent(html, "name", "twitter:image");
    if (!image) {
      return null;
    }
    try {
      return new URL(image, pageUrl).toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
