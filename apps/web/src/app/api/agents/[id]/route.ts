import { notImplemented } from "@/lib/not-implemented";

export async function PATCH(
  _request: Request,
  _context: { params: Promise<{ id: string }> },
) {
  return notImplemented();
}

export async function DELETE(
  _request: Request,
  _context: { params: Promise<{ id: string }> },
) {
  return notImplemented();
}
