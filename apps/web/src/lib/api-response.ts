import { NextResponse } from "next/server";
import { ValidationError } from "@pcc/db";
import { EnvValidationError } from "./env";

/** Consistent `{ error: string }` JSON shape used by every route in this app, including the 501 stubs. */
export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Wraps a route handler body so a missing env var or any other thrown error becomes a clean
 * `{ error }` JSON response instead of Next's opaque HTML 500 page.
 */
export async function withApiErrorHandling(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      return apiError(500, err.message);
    }
    if (err instanceof ValidationError) {
      return apiError(400, err.message);
    }
    const message = err instanceof Error ? err.message : "Unexpected error";
    return apiError(500, message);
  }
}
