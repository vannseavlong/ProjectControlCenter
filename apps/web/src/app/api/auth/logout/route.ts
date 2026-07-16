import { apiOk } from "@/lib/api-response";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const response = apiOk({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
