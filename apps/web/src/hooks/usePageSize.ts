"use client";

import { useSyncExternalStore } from "react";
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";

// Same `useSyncExternalStore`-over-localStorage pattern as /frontend's view-mode toggle (see the
// comment there for why not useState + useEffect). Per-viewer convenience only: a blocked or
// empty localStorage just falls back to the default.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(storageKey: string): number {
  try {
    const stored = Number(window.localStorage.getItem(storageKey));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(stored) ? stored : PAGE_SIZE;
  } catch {
    return PAGE_SIZE;
  }
}

/** Remembered items-per-page for one list view, keyed by `storageKey` (e.g. "pcc:frontend-page-size"). */
export function usePageSize(storageKey: string): [number, (size: number) => void] {
  const size = useSyncExternalStore(subscribe, () => read(storageKey), () => PAGE_SIZE);

  function setSize(next: number) {
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // Storage unavailable — the choice just won't survive a reload.
    }
    listeners.forEach((listener) => listener());
  }

  return [size, setSize];
}
