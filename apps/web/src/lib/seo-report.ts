import type { Project, SeoCheckResult, SeoCheckStatus, SeoSegmentKey } from "@pcc/types";

const SEGMENT_LABELS: Record<SeoSegmentKey, string> = {
  meta: "Meta",
  social: "Social",
  technical: "Technical",
  accessibility: "Accessibility",
};

const SEGMENT_ORDER: SeoSegmentKey[] = ["meta", "social", "technical", "accessibility"];

const STATUS_LABEL: Record<SeoCheckStatus, string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };

function checkLine(check: SeoCheckResult): string {
  return `- [${STATUS_LABEL[check.status]}] **${check.label}** (${SEGMENT_LABELS[check.segment]}): ${check.detail}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/**
 * Markdown hand-off of a project's last SEO scan, meant to be pasted straight into a chat/issue
 * for whoever maintains the site. Action items come first (fails, then warnings) so the reader
 * sees what to fix before what already passes. Assumes `seo_report` has been populated — callers
 * only offer this once `seo_last_analyzed` is set.
 */
export function formatSeoReportForDeveloper(project: Project): string {
  const report = project.seo_report ?? [];
  const failures = report.filter((c) => c.status === "fail");
  const warnings = report.filter((c) => c.status === "warn");
  const passes = report.filter((c) => c.status === "pass");
  const scores = project.seo_segment_scores;

  const lines: string[] = [
    `# SEO report: ${project.project_name}`,
    "",
    `- **URL:** ${project.url ?? "n/a"}`,
    ...(project.repo_url ? [`- **Repo:** ${project.repo_url}`] : []),
    `- **Analyzed:** ${formatDate(project.seo_last_analyzed)}`,
    `- **Overall score:** ${project.seo_score ?? "n/a"}/100`,
  ];

  if (scores) {
    lines.push("", "## Segment scores", "", "| Segment | Score |", "|---|---|");
    for (const segment of SEGMENT_ORDER) {
      lines.push(`| ${SEGMENT_LABELS[segment]} | ${scores[segment]}/100 |`);
    }
  }

  lines.push(
    "",
    "## What to fix",
    "",
    "Items are checked against the live homepage HTML and response headers. Please fix the FAIL items first, then the WARN items, and re-run the analysis to confirm.",
    "",
  );
  if (failures.length === 0 && warnings.length === 0) {
    lines.push("Nothing to fix. Every check passed.");
  } else {
    if (failures.length > 0) lines.push(`### Failing (${failures.length})`, "", ...failures.map(checkLine), "");
    if (warnings.length > 0) lines.push(`### Warnings (${warnings.length})`, "", ...warnings.map(checkLine), "");
  }

  if (passes.length > 0) {
    lines.push("", `## Already passing (${passes.length})`, "", ...passes.map(checkLine));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
