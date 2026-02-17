import { NextResponse } from "next/server";

/**
 * Verify cron endpoint authorization via CRON_SECRET Bearer token.
 *
 * Returns `null` when auth passes, a 401 NextResponse when it fails.
 * Usage: `const authError = verifyCronAuth(request); if (authError) return authError;`
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Auth passed
}
