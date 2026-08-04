import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { FUNNEL_EVENTS, type FunnelEvent } from "@/lib/analytics/funnel-events";
import type { Json } from "@/types/database.types";

/**
 * POST /api/funnel — the sink behind `lib/analytics/funnel-events.ts` (DESIGN §8).
 *
 * ── Why this is unauthenticated ─────────────────────────────────────────────
 * The first event in the funnel fires on `/go` before any session exists — that
 * is the denominator of `demo_view → checkout_paid`, the one number the design
 * is judged on. A 401 here would silently delete it and leave a conversion rate
 * computed over people who already converted enough to have an identity.
 *
 * So the route accepts anonymous writes, and defends itself by SHAPE instead:
 *   · the event name must be in FUNNEL_EVENTS — an unknown string is dropped,
 *     which also means a stale client can never invent a metric;
 *   · session_id must parse as a UUID;
 *   · the payload is capped and stored as-is; it is diagnostics, never a
 *     source of truth for anything billable.
 *
 * ── Why user_id is read server-side and never taken from the body ───────────
 * A client-supplied user_id is an attribution forgery waiting to happen. The
 * cookie session is the only identity this route trusts; when there is none the
 * column stays NULL and `session_id` carries the journey (see the migration).
 *
 * Reached by `navigator.sendBeacon`, which sends `text/plain` and cannot set
 * headers — so the body is parsed from text, not `req.json()` behind a
 * Content-Type check. Beacons also fire during page-hide, which is exactly when
 * the funnel's most valuable events (checkout_paid, the wall) happen.
 */

/** Beacon bodies are tiny by design; anything larger is a bug or an abuse. */
const MAX_BODY_BYTES = 4_096;

const EVENT_SET = new Set<string>(FUNNEL_EVENTS);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 });
  }

  let body: { event?: unknown; sessionId?: unknown; payload?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 204 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  // Drop silently rather than 400. The caller is a beacon: it cannot read a
  // status code, cannot retry, and a rejected event is not worth an error page.
  if (!EVENT_SET.has(event) || !UUID_RE.test(sessionId)) {
    return new Response(null, { status: 204 });
  }

  // Identity, if there is one. A missing session is the normal case on /go and
  // must not fail the write.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // An auth outage must not cost us the funnel. NULL user_id is honest.
  }

  // Cast to the generated `Json` shape rather than `Record<string, unknown>`:
  // the value has already survived JSON.parse, so it IS json by construction —
  // the cast records that, instead of asking every caller to prove it again.
  const payload: Json =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Json)
      : {};

  try {
    await createServiceClient()
      .from("funnel_events")
      .insert({
        event: event as FunnelEvent,
        session_id: sessionId,
        user_id: userId,
        payload,
      });
  } catch (error) {
    // Never surface a sink failure to the funnel it is measuring.
    console.error("[funnel] insert failed", error);
  }

  return new Response(null, { status: 204 });
}
