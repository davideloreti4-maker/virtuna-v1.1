/**
 * The onboarding funnel's event spine (`ONBOARDING-FUNNEL-DESIGN.md` §8).
 *
 * ⚠️ THE SINK IS WIRED — this header used to say it was not, and that was stale.
 * `funnel-provider.tsx` attaches `beaconSink` on mount, so `track()` reaches `funnel_events` in
 * Supabase. `track()` still buffers, and `setFunnelSink` flushes the buffer in order, so events
 * emitted before the provider mounts are not lost. Where there is genuinely no sink, `track()`
 * falls back to a dev console line.
 *
 * ⚠️ AND SOME DECLARED EVENTS STILL CANNOT FIRE — see `UNREACHABLE_FUNNEL_EVENTS` below before
 * reading a zero in this table as a user decision.
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
  // The activation beats (2026-08-04). §8 stopped at `calibrate_done` because
  // when it was written the funnel ended there — the user arrived on /home and
  // the product said one sentence. These two are the beats that replaced it:
  // the free first card, and the wall that follows it. `checkout_paid` is still
  // the scoreboard; `first_card_shown → activation_wall_shown → checkout_paid`
  // is how you tell a wall that converts from one that just interrupts.
  "first_card_shown",
  "activation_wall_shown",
  "video_submit",
  "gap_shown",
  "intention_set",
  // the 72 hours
  "prediction_checked",
  "renewal_notice_seen",
  "trial_converted",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/**
 * 🔴 Declared, but CANNOT FIRE — their only emitter is mounted by no route.
 *
 * These three live in `beats.ts`, the walkthrough's guided rail. The walkthrough was built as S1
 * (`ONBOARDING-FUNNEL-DESIGN.md` §7) and superseded three days later by `HeroShowcase`, the
 * non-interactive product window that `/go` renders today (owner call, 2026-07-27). The component
 * is complete and runs on a real frozen production analysis; nothing imports it.
 *
 * SO THEIR ZEROS ARE A CODE FACT, NOT A USER DECISION. `demo_view 23 → demo_fix_open 0` reads as
 * "23 visitors reached the demo and all 23 bounced at beat 1". Nobody bounced; nobody was offered
 * the beat. Every query over this table must exclude these three, or subtract a denominator it
 * never had.
 *
 * ⚠️ `checkout_open` is deliberately ABSENT from this list even though the walkthrough emits it.
 * It ALSO fires from `/go/page.tsx` and `checkout-modal.tsx`, both live and reachable — so its
 * zero is real and means the money screen has genuinely never been opened. Marking it would
 * explain away the one number the funnel exists to watch.
 *
 * Deleting an entry here is how you record that a surface went live. `unreachable-events.test.ts`
 * checks this list against the tree and fails if a route ever mounts the walkthrough.
 */
export const UNREACHABLE_FUNNEL_EVENTS = [
  "demo_fix_open",
  "demo_wall_shown",
  "reveal_shown",
] as const satisfies readonly FunnelEvent[];

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
