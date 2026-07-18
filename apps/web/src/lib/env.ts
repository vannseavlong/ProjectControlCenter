/** Thrown by requireEnv so callers can distinguish "misconfigured deployment" from other failures. */
export class EnvValidationError extends Error {
  constructor(name: string) {
    super(`Missing required env var: ${name}`);
    this.name = "EnvValidationError";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new EnvValidationError(name);
  }
  return value;
}

export const getRenderApiKey = (): string => requireEnv("RENDER_API_KEY");
export const getVercelApiToken = (): string => requireEnv("VERCEL_API_TOKEN");
export const getGoogleTtsApiKey = (): string => requireEnv("GOOGLE_TTS_API_KEY");
