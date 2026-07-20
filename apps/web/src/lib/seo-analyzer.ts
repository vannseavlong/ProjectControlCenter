import type { SeoCheckResult, SeoCheckStatus, SeoSegmentKey, SeoSegmentScores } from "@pcc/types";
import { extractMetaContent } from "./og-image";

/**
 * Self-built, zero-dependency heuristic SEO analyzer for `/frontend` sites — see
 * Tasks/app-backend.md §5. **User decision**: deliberately not the Google PageSpeed Insights API,
 * same "avoid an external paid/keyed service" precedent as the OG-image thumbnail scrape
 * (./og-image.ts). Consequence of that decision: there is no real performance/render metric here
 * — every check below is a static-HTML/text heuristic against the page's own markup, robots.txt,
 * and sitemap.xml. This is not a Lighthouse-equivalent score; treat it as a lightweight
 * housekeeping signal, not a certified audit.
 */

const FETCH_TIMEOUT_MS = 5_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Weight applied to each check's status when averaging a segment's score — pass=1, warn=half credit, fail=0. */
const STATUS_WEIGHT: Record<SeoCheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

function makeCheck(
  segment: SeoSegmentKey,
  id: string,
  label: string,
  status: SeoCheckStatus,
  detail: string,
): SeoCheckResult {
  return { segment, id, label, status, detail };
}

/** Strips `<script>`/`<style>` blocks and all remaining tags via regex — no HTML parser dependency, same convention as og-image.ts. */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<{ ok: boolean; text: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "text/plain,text/html,application/xml,*/*" },
    });
    if (!res.ok) {
      return { ok: false, text: null };
    }
    return { ok: true, text: await res.text() };
  } catch {
    return { ok: false, text: null };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------------------------
// meta segment: title, meta description, h1 count, rough word count (thin-content flag)
// ---------------------------------------------------------------------------------------------
function checkMeta(html: string): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  if (!title) {
    results.push(makeCheck("meta", "title-length", "Title tag", "fail", "No <title> tag found."));
  } else if (title.length < 10 || title.length > 60) {
    results.push(
      makeCheck(
        "meta",
        "title-length",
        "Title tag",
        "warn",
        `Title is ${title.length} characters — recommended range is 10-60 ("${title}").`,
      ),
    );
  } else {
    results.push(
      makeCheck("meta", "title-length", "Title tag", "pass", `Title is ${title.length} characters ("${title}").`),
    );
  }

  const description = extractMetaContent(html, "name", "description");
  if (!description) {
    results.push(
      makeCheck("meta", "meta-description-length", "Meta description", "fail", "No meta description tag found."),
    );
  } else if (description.length < 50 || description.length > 160) {
    results.push(
      makeCheck(
        "meta",
        "meta-description-length",
        "Meta description",
        "warn",
        `Meta description is ${description.length} characters — recommended range is 50-160.`,
      ),
    );
  } else {
    results.push(
      makeCheck(
        "meta",
        "meta-description-length",
        "Meta description",
        "pass",
        `Meta description is ${description.length} characters.`,
      ),
    );
  }

  const h1Count = (html.match(/<h1\b[^>]*>/gi) ?? []).length;
  if (h1Count === 1) {
    results.push(makeCheck("meta", "h1-count", "Single <h1>", "pass", "Exactly one <h1> found."));
  } else if (h1Count === 0) {
    results.push(makeCheck("meta", "h1-count", "Single <h1>", "fail", "No <h1> found on the page."));
  } else {
    results.push(makeCheck("meta", "h1-count", "Single <h1>", "warn", `${h1Count} <h1> tags found — expected exactly 1.`));
  }

  const wordCount = stripTags(html)
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  if (wordCount >= 300) {
    results.push(makeCheck("meta", "word-count", "Content length", "pass", `~${wordCount} words of visible text.`));
  } else if (wordCount >= 150) {
    results.push(
      makeCheck("meta", "word-count", "Content length", "warn", `~${wordCount} words — possibly thin content (under 300).`),
    );
  } else {
    results.push(
      makeCheck("meta", "word-count", "Content length", "fail", `~${wordCount} words — likely thin content (under 150).`),
    );
  }

  return results;
}

// ---------------------------------------------------------------------------------------------
// social segment: Open Graph + Twitter Card tags
// ---------------------------------------------------------------------------------------------
function checkSocial(html: string): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];
  const ogTitle = extractMetaContent(html, "property", "og:title");
  const ogDescription = extractMetaContent(html, "property", "og:description");
  const ogImage = extractMetaContent(html, "property", "og:image");
  const twitterCard = extractMetaContent(html, "name", "twitter:card");

  results.push(
    makeCheck("social", "og-title", "og:title", ogTitle ? "pass" : "fail", ogTitle ? `Found: "${ogTitle}"` : "Missing og:title."),
  );
  results.push(
    makeCheck(
      "social",
      "og-description",
      "og:description",
      ogDescription ? "pass" : "fail",
      ogDescription ? "Found." : "Missing og:description.",
    ),
  );
  results.push(
    makeCheck("social", "og-image", "og:image", ogImage ? "pass" : "fail", ogImage ? `Found: ${ogImage}` : "Missing og:image."),
  );
  results.push(
    makeCheck(
      "social",
      "twitter-card",
      "twitter:card",
      twitterCard ? "pass" : "fail",
      twitterCard ? `Found: "${twitterCard}"` : "Missing twitter:card.",
    ),
  );
  return results;
}

/** True if robots.txt disallows everything for `User-agent: *` (a literal `Disallow: /` line in that block). */
function robotsDisallowsAll(robotsText: string): boolean {
  let inStarBlock = false;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key === "user-agent") {
      inStarBlock = value === "*";
      continue;
    }
    if (inStarBlock && key === "disallow" && value === "/") {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// technical segment: HTTPS, robots.txt, sitemap.xml, canonical link, viewport
// ---------------------------------------------------------------------------------------------
function checkTechnical(
  html: string,
  homepageUrl: URL,
  robots: { ok: boolean; text: string | null },
  sitemapDirect: { ok: boolean; text: string | null },
): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];

  results.push(
    makeCheck(
      "technical",
      "https",
      "HTTPS",
      homepageUrl.protocol === "https:" ? "pass" : "fail",
      homepageUrl.protocol === "https:" ? "Site is served over HTTPS." : "Site is not served over HTTPS.",
    ),
  );

  if (!robots.ok || !robots.text) {
    results.push(makeCheck("technical", "robots-reachable", "robots.txt reachable", "fail", "robots.txt not reachable."));
    results.push(
      makeCheck(
        "technical",
        "robots-not-disallow-all",
        "robots.txt allows crawling",
        "fail",
        "Could not evaluate — robots.txt not reachable.",
      ),
    );
  } else {
    results.push(makeCheck("technical", "robots-reachable", "robots.txt reachable", "pass", "robots.txt reachable."));
    const disallowsAll = robotsDisallowsAll(robots.text);
    results.push(
      makeCheck(
        "technical",
        "robots-not-disallow-all",
        "robots.txt allows crawling",
        disallowsAll ? "fail" : "pass",
        disallowsAll ? "robots.txt disallows all crawlers (Disallow: / for User-agent: *)." : "robots.txt does not block all crawlers.",
      ),
    );
  }

  let sitemapReachable = sitemapDirect.ok;
  let sitemapDetail = sitemapDirect.ok ? "sitemap.xml reachable at /sitemap.xml." : "sitemap.xml not reachable at /sitemap.xml.";
  if (!sitemapReachable && robots.text && /^\s*sitemap:/im.test(robots.text)) {
    sitemapReachable = true;
    sitemapDetail = "sitemap.xml not found at /sitemap.xml, but referenced via a Sitemap: line in robots.txt.";
  }
  results.push(
    makeCheck("technical", "sitemap-reachable", "Sitemap present", sitemapReachable ? "pass" : "fail", sitemapDetail),
  );

  const hasCanonical = /<link[^>]*rel=["']canonical["'][^>]*>/i.test(html);
  results.push(
    makeCheck(
      "technical",
      "canonical",
      "Canonical link",
      hasCanonical ? "pass" : "warn",
      hasCanonical ? "Found <link rel=\"canonical\">." : "No <link rel=\"canonical\"> found.",
    ),
  );

  const hasViewport = extractMetaContent(html, "name", "viewport") !== null;
  results.push(
    makeCheck(
      "technical",
      "viewport",
      "Viewport meta tag",
      hasViewport ? "pass" : "fail",
      hasViewport ? "Found <meta name=\"viewport\">." : "No <meta name=\"viewport\"> found.",
    ),
  );

  return results;
}

/** Extracts every `<img ...>` opening tag verbatim — shared by the accessibility and modern-image-format checks. */
function extractImgTags(html: string): string[] {
  return html.match(/<img\b[^>]*>/gi) ?? [];
}

const MODERN_IMAGE_EXTENSIONS = new Set(["webp", "avif"]);
const LEGACY_RASTER_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp"]);

/** Share of `<img>` tags using a modern (WebP/AVIF) format vs. legacy raster formats — vector/unknown extensions are ignored, not counted against the site. */
function checkModernImageFormats(imgTags: string[]): SeoCheckResult {
  let modernCount = 0;
  let legacyCount = 0;
  for (const tag of imgTags) {
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    const ext = src?.split(/[?#]/)[0]?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (!ext) continue;
    if (MODERN_IMAGE_EXTENSIONS.has(ext)) modernCount++;
    else if (LEGACY_RASTER_EXTENSIONS.has(ext)) legacyCount++;
  }
  const total = modernCount + legacyCount;
  if (total === 0) {
    return makeCheck(
      "technical",
      "modern-image-formats",
      "Modern image formats",
      "pass",
      "No JPEG/PNG/GIF/WebP/AVIF <img> tags to evaluate.",
    );
  }
  const share = modernCount / total;
  const detail = `${modernCount}/${total} raster images use a modern format (WebP/AVIF).`;
  // Never "fail" here — using JPEG/PNG isn't an error, just a missed optimization, same soft-signal
  // treatment as the canonical-link and heading-hierarchy checks above.
  return makeCheck("technical", "modern-image-formats", "Modern image formats", share >= 0.5 ? "pass" : "warn", detail);
}

/** Presence of `<link rel="icon">` (or `shortcut icon`/`apple-touch-icon`, all matched via the shared `icon` word boundary) and `<link rel="manifest">`. */
function checkFaviconAndManifest(html: string): SeoCheckResult[] {
  const hasIcon = /<link[^>]*rel=["'][^"']*\bicon\b[^"']*["'][^>]*>/i.test(html);
  const hasManifest = /<link[^>]*rel=["']manifest["'][^>]*>/i.test(html);
  return [
    makeCheck(
      "technical",
      "favicon",
      "Favicon",
      hasIcon ? "pass" : "fail",
      hasIcon ? "Found a favicon <link>." : 'No favicon <link rel="icon"> found.',
    ),
    makeCheck(
      "technical",
      "web-manifest",
      "Web app manifest",
      hasManifest ? "pass" : "warn",
      hasManifest
        ? 'Found <link rel="manifest">.'
        : 'No <link rel="manifest"> found — optional, but improves mobile/PWA presentation.',
    ),
  ];
}

/** Presence of a JSON-LD structured-data block — doesn't validate the schema itself, just that one exists. */
function checkStructuredData(html: string): SeoCheckResult {
  const hasJsonLd = /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html);
  return makeCheck(
    "technical",
    "structured-data",
    "Structured data (JSON-LD)",
    hasJsonLd ? "pass" : "warn",
    hasJsonLd
      ? "Found a JSON-LD <script> block."
      : "No JSON-LD structured data found — recommended for rich search results.",
  );
}

/** Presence of the HSTS / X-Content-Type-Options / CSP response headers on the homepage fetch. */
function checkSecurityHeaders(headers: Headers): SeoCheckResult {
  const wanted: [string, string][] = [
    ["strict-transport-security", "HSTS"],
    ["x-content-type-options", "X-Content-Type-Options"],
    ["content-security-policy", "CSP"],
  ];
  const present = wanted.filter(([header]) => headers.get(header) !== null).map(([, label]) => label);
  const missing = wanted.filter(([header]) => headers.get(header) === null).map(([, label]) => label);
  const status: SeoCheckStatus = present.length === wanted.length ? "pass" : present.length > 0 ? "warn" : "fail";
  const detail =
    present.length > 0
      ? `Present: ${present.join(", ")}.${missing.length > 0 ? ` Missing: ${missing.join(", ")}.` : ""}`
      : `Missing: ${missing.join(", ")}.`;
  return makeCheck("technical", "security-headers", "Security headers", status, detail);
}

// ---------------------------------------------------------------------------------------------
// accessibility segment: img alt coverage, html lang, heading-level jump sanity
// ---------------------------------------------------------------------------------------------
function checkAccessibility(html: string, imgTags: string[]): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];

  // An image "counts" as covered if it has an `alt` attribute at all, including `alt=""` —
  // an empty alt is the correct, deliberate pattern for decorative images, not a violation.
  const coveredCount = imgTags.filter((tag) => /\balt\s*=\s*["'][^"']*["']/i.test(tag)).length;
  if (imgTags.length === 0) {
    results.push(makeCheck("accessibility", "img-alt-coverage", "Image alt-text coverage", "pass", "No <img> tags found."));
  } else {
    const coverage = coveredCount / imgTags.length;
    const detail = `${coveredCount}/${imgTags.length} images (${Math.round(coverage * 100)}%) have an alt attribute.`;
    if (coverage >= 0.9) {
      results.push(makeCheck("accessibility", "img-alt-coverage", "Image alt-text coverage", "pass", detail));
    } else if (coverage >= 0.5) {
      results.push(makeCheck("accessibility", "img-alt-coverage", "Image alt-text coverage", "warn", detail));
    } else {
      results.push(makeCheck("accessibility", "img-alt-coverage", "Image alt-text coverage", "fail", detail));
    }
  }

  const hasLang = /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html);
  results.push(
    makeCheck(
      "accessibility",
      "html-lang",
      "<html lang> attribute",
      hasLang ? "pass" : "fail",
      hasLang ? "Found lang attribute on <html>." : "No lang attribute on <html>.",
    ),
  );

  const headingMatches = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)];
  let skippedLevel = false;
  let previousLevel: number | null = null;
  for (const match of headingMatches) {
    const level = Number(match[1]);
    if (previousLevel !== null && level > previousLevel + 1) {
      skippedLevel = true;
      break;
    }
    previousLevel = level;
  }
  if (headingMatches.length === 0) {
    results.push(makeCheck("accessibility", "heading-hierarchy", "Heading hierarchy", "warn", "No headings (<h1>-<h6>) found."));
  } else if (skippedLevel) {
    results.push(
      makeCheck("accessibility", "heading-hierarchy", "Heading hierarchy", "warn", "A heading level is skipped (e.g. <h2> to <h4>)."),
    );
  } else {
    results.push(makeCheck("accessibility", "heading-hierarchy", "Heading hierarchy", "pass", "No skipped heading levels detected."));
  }

  return results;
}

function computeSegmentScores(report: SeoCheckResult[]): SeoSegmentScores {
  const segments: SeoSegmentKey[] = ["meta", "social", "technical", "accessibility"];
  const scores = {} as SeoSegmentScores;
  for (const segment of segments) {
    const checks = report.filter((check) => check.segment === segment);
    const total = checks.reduce((sum, check) => sum + STATUS_WEIGHT[check.status], 0);
    scores[segment] = checks.length === 0 ? 0 : Math.round((total / checks.length) * 100);
  }
  return scores;
}

/**
 * Runs the full heuristic SEO analysis against `baseUrl`'s homepage.
 *
 * Only throws if the homepage fetch itself fails (unreachable, timeout, non-2xx) — a
 * robots.txt/sitemap.xml sub-fetch failure never throws, it just fails those specific checks, so
 * the caller (POST /api/projects/:id/analyze-seo) can distinguish "couldn't scan at all" (502)
 * from "scanned successfully, scored low" (200 with a low score).
 *
 * Overall `score` is a plain, equal-weighted average of the 4 segment scores — a deliberate
 * simplification, not a Lighthouse-equivalent metric (no real performance/render measurement is
 * possible without a browser, which this analyzer intentionally doesn't use).
 */
export async function analyzeSeo(
  baseUrl: string,
): Promise<{ score: number; segmentScores: SeoSegmentScores; report: SeoCheckResult[] }> {
  const homepageUrl = new URL(baseUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  let homepageHeaders: Headers;
  try {
    const res = await fetch(baseUrl, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) {
      throw new Error(`Homepage responded with HTTP ${res.status}`);
    }
    homepageHeaders = res.headers;
    html = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not fetch ${baseUrl}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  const [robots, sitemapDirect] = await Promise.all([
    fetchText(new URL("/robots.txt", homepageUrl).toString()),
    fetchText(new URL("/sitemap.xml", homepageUrl).toString()),
  ]);

  const imgTags = extractImgTags(html);

  const report: SeoCheckResult[] = [
    ...checkMeta(html),
    ...checkSocial(html),
    ...checkTechnical(html, homepageUrl, robots, sitemapDirect),
    ...checkFaviconAndManifest(html),
    checkStructuredData(html),
    checkSecurityHeaders(homepageHeaders),
    checkModernImageFormats(imgTags),
    ...checkAccessibility(html, imgTags),
  ];

  const segmentScores = computeSegmentScores(report);
  const score = Math.round((segmentScores.meta + segmentScores.social + segmentScores.technical + segmentScores.accessibility) / 4);

  return { score, segmentScores, report };
}
