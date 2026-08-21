import { NextResponse } from "next/server";

/**
 * Verify cron endpoint authorization via CRON_SECRET Bearer token.
 *
 * Returns `null` when auth passes, a 401 NextResponse when it fails.
 * Usage: `const authError = verifyCronAuth(request); if (authError) return authError;`
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  // Fail closed: without a configured secret, `Bearer undefined` would match.
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Auth passed
}
