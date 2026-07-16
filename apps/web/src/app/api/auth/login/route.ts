import { apiError, apiOk, withApiErrorHandling } from "@/lib/api-response";
import { requireEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return apiError(400, "Request body must be JSON");
    }

    const { email, password } = body;
    if (typeof email !== "string" || typeof password !== "string") {
      return apiError(400, "email and password are required");
    }

    const allowedEmail = requireEnv("AUTH_ALLOWED_EMAIL");
    if (email.trim().toLowerCase() !== allowedEmail.trim().toLowerCase() || !verifyPassword(password)) {
      return apiError(401, "Invalid email or password");
    }

    const token = await createSessionToken(email);
    const response = apiOk({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  });
}
