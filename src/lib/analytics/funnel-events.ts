/**
 * The onboarding funnel's event spine (`ONBOARDING-FUNNEL-DESIGN.md` §8).
 *
 * ⚠️ THERE IS NO SINK YET. `track()` buffers in memory and logs in dev. Nothing leaves the
 * browser. This module exists so the CALL SITES are correct from the first commit — those are
 * the expensive part to retrofit, and a funnel you cannot measure is a funnel you cannot debug.
 * Wiring a sink is one function body (`FUNNEL_SINK`), not a sweep through the components.
 *
 * The scoreboard is `checkout_paid`. Everything else is diagnostics for that one number:
 *   1. demo_view    → checkout_paid   the milestone
 *   2. demo_pick    → demo_fix_open   does the demo land its aha, or is it decorative?
 *   3. checkout_paid → gap_shown      the cancellation predictor
 */

/** Funnel events in order. Adding one here is the only way to emit it — `track` is typed to this. */
export const FUNNEL_EVENTS = [
  // pre-account, on /go
  "demo_view",
  "demo_pick",
  "demo_scrub",
  "demo_fix_open", // beat 1's fix opened — the mechanism proof landed
  "demo_wall_shown", // beat 2 reached, content genuinely withheld
  // the money
  "checkout_open",
  "checkout_paid",
  // identity now runs AFTER the money (design §0a ①)
  "reveal_shown", // the withheld fix, honored before anything is asked
  "otp_start",
  "otp_done",
  // the real platform
  "start_landed",
  "handle_submit",
  "calibrate_done",
  "video_submit",
  "gap_shown",
  "intention_set",
  // the 72 hours
  "prediction_checked",
  "renewal_notice_seen",
  "trial_converted",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export interface FunnelPayload {
  /** Which beat of the walkthrough, where the event has one. */
  beat?: string;
  /** Which example video the visitor saw — the fixture is multi-video-ready by design (§6.1). */
  stimulus?: string;
  /** Milliseconds since `demo_view`. Time-to-aha is budgeted (~10s to beat 1, ~45s to the wall). */
  sinceViewMs?: number;
  [key: string]: string | number | boolean | undefined;
}

interface BufferedEvent {
  event: FunnelEvent;
  payload: FunnelPayload;
  /** ms since page load — `performance.now`, not a wall clock, so it is monotonic. */
  at: number;
}

const buffer: BufferedEvent[] = [];
let viewAt: number | null = null;

/**
 * Replace this to ship events somewhere. Kept as a mutable module binding rather than an import
 * so a sink can be attached from a client provider without this module knowing about it.
 *
 * Use `navigator.sendBeacon` when you wire it — this traffic is mobile webviews, and a `fetch`
 * in flight when the page is backgrounded is a dropped event.
 */
export let FUNNEL_SINK: ((e: BufferedEvent) => void) | null = null;

export function setFunnelSink(sink: ((e: BufferedEvent) => void) | null): void {
  FUNNEL_SINK = sink;
  // Flush whatever happened before the sink attached, in order. Beacons are cheap; a missing
  // `demo_view` would silently break the one ratio the whole funnel is judged on.
  if (sink) buffer.forEach(sink);
}

export function track(event: FunnelEvent, payload: FunnelPayload = {}): void {
  const at = typeof performance !== "undefined" ? performance.now() : 0;
  if (event === "demo_view" && viewAt === null) viewAt = at;

  const enriched: FunnelPayload = { ...payload };
  if (viewAt !== null && enriched.sinceViewMs === undefined) {
    enriched.sinceViewMs = Math.round(at - viewAt);
  }

  const record: BufferedEvent = { event, payload: enriched, at };
  buffer.push(record);

  if (FUNNEL_SINK) FUNNEL_SINK(record);
  else if (process.env.NODE_ENV === "development") {
    console.info(`[funnel] ${event}`, enriched);
  }
}

/** Test/debug read of what has been emitted. Not for product code. */
export function __funnelBuffer(): readonly BufferedEvent[] {
  return buffer;
}

/** Test-only reset — the buffer and the `demo_view` clock are module state. */
export function __resetFunnel(): void {
  buffer.length = 0;
  viewAt = null;
  FUNNEL_SINK = null;
}
