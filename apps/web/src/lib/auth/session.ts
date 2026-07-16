import { requireEnv } from "@/lib/env";

/**
 * Edge-safe on purpose (Web Crypto, no `node:crypto`) — this file is imported by
 * `middleware.ts`, which runs on the Edge runtime by default in Next.js.
 */
export const SESSION_COOKIE = "pcc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface SessionPayload {
  email: string;
  expires: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getHmacKey(): Promise<CryptoKey> {
  const secret = requireEnv("AUTH_SESSION_SECRET");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(email: string): Promise<string> {
  const payload: SessionPayload = { email, expires: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource);
  return `${base64UrlEncode(payloadBytes)}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** A tampered or malformed cookie must fail closed (return null), never throw — this runs on every request in the proxy, and an uncaught error there 500s the whole app instead of just bouncing to /login. */
export async function verifySessionToken(token: string): Promise<{ email: string } | null> {
  try {
    const [payloadPart, signaturePart] = token.split(".");
    if (!payloadPart || !signaturePart) return null;

    const key = await getHmacKey();
    const payloadBytes = base64UrlDecode(payloadPart);
    const signatureBytes = base64UrlDecode(signaturePart);
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes as BufferSource, payloadBytes as BufferSource);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    if (payload.expires < Date.now()) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
