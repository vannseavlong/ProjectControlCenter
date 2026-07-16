import { NextResponse } from "next/server";

/** Placeholder response for API routes scaffolded ahead of their Phase 1+ implementation. */
export function notImplemented(): NextResponse {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
