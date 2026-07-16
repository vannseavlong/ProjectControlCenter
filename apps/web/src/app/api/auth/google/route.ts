import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getGoogleAuthUrl } from "@/lib/auth/google";

const OAUTH_STATE_COOKIE = "pcc_oauth_state";

export async function GET() {
  const state = randomUUID();
  const response = NextResponse.redirect(getGoogleAuthUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return response;
}
