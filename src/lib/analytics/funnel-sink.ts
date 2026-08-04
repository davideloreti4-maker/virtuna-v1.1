/**
 * The browser half of the funnel sink (DESIGN §8) — what `funnel-events.ts`
 * always said would be "one function body, not a sweep through the components".
 * This is that function body.
 *
 * ── sendBeacon, not fetch ───────────────────────────────────────────────────
 * `funnel-events.ts` calls for it by name and the reason is the traffic profile:
 * §2a says this funnel runs inside TikTok/Instagram in-app webviews, and a
 * `fetch` still in flight when the webview is backgrounded is a dropped event.
 * Beacons are queued by the browser and survive the page going away — which is
 * precisely when `checkout_paid` and the wall events fire.
 *
 * ── The session id is per VISITOR, not per page load ────────────────────────
 * It has to outlive the anonymous→identified transition, because §0b② links the
 * email onto the same anonymous user only AFTER checkout. Keying the journey on
 * user identity would split `demo_view` and `trial_converted` across two rows
 * with nothing joining them. localStorage, minted once, is what makes the one
 * ratio in §8 computable.
 */

const SESSION_KEY = "numen.funnel.session";

/**
 * `crypto.randomUUID` is unavailable on `http://` origins other than localhost,
 * which includes some in-app webview previews — so there is a fallback rather
 * than a throw. The server validates the UUID shape either way.
 */
function mintId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[(Math.floor(Math.random() * 16) & 0x3) | 0x8];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

/** The visitor's funnel id, minted on first use and reused forever after. */
export function funnelSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = mintId();
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / quota. A per-load id still records the events; only
    // cross-visit stitching is lost, which beats recording nothing.
    return mintId();
  }
}

/** Ship one buffered event. Shaped to `setFunnelSink`'s callback. */
export function beaconSink(e: { event: string; payload: Record<string, unknown> }): void {
  if (typeof navigator === "undefined") return;

  const body = JSON.stringify({
    event: e.event,
    sessionId: funnelSessionId(),
    payload: e.payload,
  });

  try {
    if (navigator.sendBeacon) {
      // text/plain keeps it a CORS-simple request — no preflight, which a
      // backgrounding webview may never live long enough to complete.
      navigator.sendBeacon("/api/funnel", new Blob([body], { type: "text/plain" }));
      return;
    }
    void fetch("/api/funnel", { method: "POST", body, keepalive: true });
  } catch {
    // A funnel that throws into the product it measures is worse than a blind one.
  }
}
