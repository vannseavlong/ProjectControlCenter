import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

const OAUTH_STATE_COOKIE = "pcc_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=oauth_state", url));
  }

  try {
    const payload = await exchangeGoogleCode(code);
    const allowedEmail = requireEnv("AUTH_ALLOWED_EMAIL");
    if (!payload.email_verified || payload.email.trim().toLowerCase() !== allowedEmail.trim().toLowerCase()) {
      return NextResponse.redirect(new URL("/login?error=not_allowed", url));
    }

    const token = await createSessionToken(payload.email);
    const response = NextResponse.redirect(new URL("/", url));
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url));
  }
}
