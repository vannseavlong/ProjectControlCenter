import { requireEnv } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleIdTokenPayload {
  email: string;
  email_verified: boolean;
}

/**
 * Exchanges the authorization code directly with Google over HTTPS and trusts the returned
 * `id_token` payload without a separate JWKS signature check — the trust boundary is the direct
 * server-to-server call to `oauth2.googleapis.com`, not anything supplied by the browser.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleIdTokenPayload> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed with status ${response.status}`);
  }

  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("Google token response had no id_token");
  }
  const payloadSegment = data.id_token.split(".")[1];
  if (!payloadSegment) {
    throw new Error("Malformed id_token");
  }
  return JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as GoogleIdTokenPayload;
}
