"use client";

import { useEffect } from "react";
import { setFunnelSink } from "@/lib/analytics/funnel-events";
import { beaconSink } from "@/lib/analytics/funnel-sink";

/**
 * Attaches the beacon sink to the funnel spine, once, for the whole app.
 *
 * Mounted in the ROOT layout rather than in `(app)/providers.tsx`, because the
 * funnel starts on `/go` and `/` — surfaces that never mount the app providers.
 * The first event in §8's order (`demo_view`) fires before a session exists, so
 * a sink scoped to the authed shell would miss the denominator of the only
 * ratio the design is judged on.
 *
 * `setFunnelSink` flushes whatever `track()` buffered before this effect ran, in
 * order, so events emitted during the same tick as the first paint are not lost
 * to mount timing.
 */
export function FunnelProvider() {
  useEffect(() => {
    setFunnelSink(beaconSink);
    return () => setFunnelSink(null);
  }, []);

  return null;
}
