/** Default items per page for every client-side-paginated list view (`/backend`, `/frontend`) — shared so they can't drift apart, see `@pcc/ui`'s `Pagination`. */
export const PAGE_SIZE = 10;

/** Choices offered by `PageSizeSelect`; the viewer's pick is remembered per page, see `usePageSize`. */
export const PAGE_SIZE_OPTIONS = [10, 15, 20, 25, 30, 40, 50] as const;
