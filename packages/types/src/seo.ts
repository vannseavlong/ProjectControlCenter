/** The four independently-scored segments of a heuristic SEO analysis — see src/lib/seo-analyzer.ts. */
export type SeoSegmentKey = "meta" | "social" | "technical" | "accessibility";

export type SeoCheckStatus = "pass" | "warn" | "fail";

/** One individual heuristic check's result (e.g. "title length", "og:image present"). */
export interface SeoCheckResult {
  segment: SeoSegmentKey;
  /** Stable machine-readable id for this check, e.g. "title-length" — unique within a segment. */
  id: string;
  /** Short human-readable label for display, e.g. "Title length". */
  label: string;
  status: SeoCheckStatus;
  /** Human-readable explanation of the result, safe to show directly in the UI. */
  detail: string;
}

/** Each segment's 0–100 score — plain average of the 4 values is the overall `seo_score`. */
export interface SeoSegmentScores {
  meta: number;
  social: number;
  technical: number;
  accessibility: number;
}
