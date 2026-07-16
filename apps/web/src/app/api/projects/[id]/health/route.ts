import { notImplemented } from "@/lib/not-implemented";

export async function GET(
  _request: Request,
  _context: { params: Promise<{ id: string }> },
) {
  return notImplemented();
}
