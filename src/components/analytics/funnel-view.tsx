"use client";

import { useEffect, useRef } from "react";
import { track, type FunnelEvent, type FunnelPayload } from "@/lib/analytics/funnel-events";

/**
 * Fires one funnel event on mount — the "this surface was seen" beat.
 *
 * Exists so SERVER pages can participate in the funnel without becoming client
 * components: `/go` and `/home` are both server-rendered, and `demo_view` /
 * `start_landed` are the two events that bracket the entire money path. Dropping
 * a one-line marker beside the page body is cheaper than converting a page.
 *
 * Guarded against React's double-invoke in dev StrictMode. That guard is not
 * cosmetic here — `demo_view` is the denominator of `demo_view → checkout_paid`,
 * so counting it twice would halve the headline conversion rate of the product.
 */
export function FunnelView({
  event,
  payload,
}: {
  event: FunnelEvent;
  payload?: FunnelPayload;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, payload);
    // `payload` is intentionally not a dependency — this fires once per mount,
    // and a caller passing an inline object literal would otherwise re-fire on
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
