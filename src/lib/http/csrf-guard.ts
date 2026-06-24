/**
 * csrfGuard — the shared Content-Type + cross-origin CSRF guard for state-mutating
 * POST routes (WR-01).
 *
 * Auth on these routes is cookie-based (`supabase.auth.getUser()`), so a cross-origin
 * form/fetch POST from a malicious page carries the victim's session cookie and
 * passes the auth gate. These routes mutate state (persist thread messages, consume
 * the Discover daily cap, spend Apify/Qwen budget), so the CSRF exposure is real.
 *
 * Two checks, mirroring the long-standing inline pattern in remix/run, remix/adapt,
 * and creator-profile (T-04-07 / T-06-14):
 *   1. Content-Type must be exactly `application/json` (415 otherwise) — blocks the
 *      simple-request CSRF vector (form posts cannot set application/json without a
 *      preflight, and a mismatched content-type is rejected outright). EXEMPT for
 *      bodyless `DELETE`: DELETE is a non-simple method (always CORS-preflighted
 *      cross-origin) and carries no body, so requiring application/json on it adds zero
 *      CSRF protection while 415-ing legitimate bodyless deletes. The Origin check (2)
 *      still guards DELETE.
 *   2. If an `Origin` header is present, it must match the request's own origin
 *      (403 otherwise) — blocks cross-origin fetch/XHR.
 *
 * Usage (call immediately after the auth gate, before any body parse or DB work):
 *   const guard = csrfGuard(request);
 *   if (guard) return guard;
 *
 * @param request - the incoming Request.
 * @returns a 415/403 Response when the request fails a guard, or `null` when it passes.
 */
export function csrfGuard(request: Request): Response | null {
  // ── Content-Type 415 guard ──────────────────────────────────────────────────
  // Skip for DELETE: non-simple method (preflighted) + bodyless, so the content-type
  // requirement only blocks legitimate deletes without adding CSRF protection. The
  // Origin check below still guards it. Body-carrying methods (POST/PUT/PATCH) keep it.
  if (request.method.toUpperCase() !== "DELETE") {
    const contentType = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      ?.toLowerCase();
    if (contentType !== "application/json") {
      return Response.json({ error: "Unsupported Media Type" }, { status: 415 });
    }
  }

  // ── Cross-origin 403 guard ──────────────────────────────────────────────────
  const origin = request.headers.get("origin");
  if (origin) {
    const url = new URL(request.url);
    const expectedOrigin = `${url.protocol}//${url.host}`;
    if (origin !== expectedOrigin) {
      return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
    }
  }

  return null;
}
