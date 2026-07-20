import { Badge, type StatusDotTone } from "@pcc/ui";
import { seoScoreTone } from "@/lib/format";

/**
 * Tone → Tailwind class triad (border/text for badges, bg for solid fills like the segment
 * bars on `/frontend/[id]`) — centralized here since `seoScoreTone` (lib/format.ts) is reused
 * across the grid card, list row, and detail page, and `packages/ui` deliberately doesn't ship
 * a tone→class helper of its own (StatusDot hardcodes its own dot colors internally).
 */
export const SEO_TONE_CLASSES: Record<StatusDotTone, { border: string; text: string; bg: string }> = {
  up: { border: "border-status-up/40", text: "text-status-up", bg: "bg-status-up" },
  sleeping: { border: "border-status-sleeping/40", text: "text-status-sleeping", bg: "bg-status-sleeping" },
  down: { border: "border-status-down/40", text: "text-status-down", bg: "bg-status-down" },
  unknown: { border: "border-status-unknown/40", text: "text-status-unknown", bg: "bg-status-unknown" },
};

/**
 * SEO score badge shared by `SiteCard`, `SiteListRow`, and `/frontend/[id]` — "SEO 82" tone-colored
 * by `seoScoreTone`, or "Not scanned" when `seo_score` is unset. Accepts `null` as well as
 * `undefined` — `GET /api/projects` serializes every unset optional column as JSON `null`, not an
 * absent key, despite the `Project` type saying `number | undefined` (verified live, see
 * `seoScoreTone`'s doc comment in lib/format.ts).
 */
export function SeoScoreBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const tone = seoScoreTone(score);
  const toneClasses = SEO_TONE_CLASSES[tone];
  return (
    <Badge variant="outline" className={`${toneClasses.border} ${toneClasses.text} ${className ?? ""}`}>
      {score == null ? "Not scanned" : `SEO ${score}`}
    </Badge>
  );
}
