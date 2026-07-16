import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

export interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Always shows page 1, the last page, and up to one page on either side of the current page,
 * collapsing any gap into a single "ellipsis" marker — keeps the control usable at both ends of
 * the scale (a handful of pages, or a few hundred) without needing every page number rendered.
 */
function getPageWindow(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const window: (number | "ellipsis")[] = [1];
  if (page > 3) window.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) window.push(i);

  if (page < totalPages - 2) window.push("ellipsis");
  window.push(totalPages);

  return window;
}

/** Shared page-number + Previous/Next control, used by any list view that paginates client-side (`/backend`, `/frontend`). */
export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-end gap-1.5 border-t border-input pt-3", className)}
    >
      <Button
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs text-muted-foreground"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-3.5" />
        Previous
      </Button>

      {getPageWindow(page, totalPages).map((entry, i) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={entry}
            variant={entry === page ? "primary" : "secondary"}
            className="h-8 min-w-8 px-2 text-xs"
            aria-label={`Page ${entry}`}
            aria-current={entry === page ? "page" : undefined}
            onClick={() => onPageChange(entry)}
          >
            {entry}
          </Button>
        ),
      )}

      <Button
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs text-muted-foreground"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="size-3.5" />
      </Button>
    </nav>
  );
}
