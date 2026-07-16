import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

const SCRYPT_KEY_LENGTH = 64;

/** `AUTH_PASSWORD_HASH` is stored as `"<saltHex>:<hashHex>"` — see apps/web/.env.example for how to generate one. */
export function verifyPassword(password: string): boolean {
  const stored = requireEnv("AUTH_PASSWORD_HASH");
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), SCRYPT_KEY_LENGTH);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Not called at runtime — a local helper for generating an `AUTH_PASSWORD_HASH` value. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
