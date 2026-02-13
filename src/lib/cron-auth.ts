import { NextResponse } from "next/server";

/**
 * Verify CRON_SECRET Bearer token from request headers.
 * Returns null if authorized, or a 401 NextResponse if not.
 *
 * Usage:
 *   const authError = verifyCronAuth(request);
 *   if (authError) return authError;
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
