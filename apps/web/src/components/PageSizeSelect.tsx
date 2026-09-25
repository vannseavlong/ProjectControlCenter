"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pcc/ui";
import { PAGE_SIZE_OPTIONS } from "@/lib/constants";

/** "Show N per page" picker paired with `@pcc/ui`'s `Pagination` on the list views. */
export function PageSizeSelect({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Show</span>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger className="h-8 w-20 text-xs" aria-label="Items per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>per page</span>
    </div>
  );
}
