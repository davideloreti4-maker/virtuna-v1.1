/**
 * In-app browser (embedded webview) detection.
 *
 * WHY THIS EXISTS: the product's traffic is organic TikTok / Instagram / social
 * (owner, 2026-07-24), and those apps open links in an EMBEDDED WEBVIEW rather
 * than the system browser. That single fact breaks the identity step:
 *
 *   - Google refuses OAuth from embedded webviews outright (`disallowed_useragent`).
 *     It is their policy, not a bug we can patch — the user gets a Google error
 *     page mid-funnel, between the demo and the checkout.
 *   - An emailed confirmation LINK is just as fatal: tapping it leaves the webview
 *     for a different browser, where the session, the referral cookie and the
 *     checkout intent do not exist.
 *
 * So the funnel's primary identity path is an emailed 6-digit CODE typed back into
 * the same page (see `otp.ts`), and Google is offered only where it actually works.
 * This module decides "where it actually works".
 *
 * UA sniffing is normally a smell. It is the correct tool here because the thing we
 * are detecting IS the user-agent string — there is no feature test for "Google will
 * reject this browser", and guessing wrong in the optimistic direction costs a signup
 * at the exact moment the visitor was ready to pay.
 */

/**
 * Signatures of the embedded webviews our traffic actually arrives in.
 *
 * TikTok is the messy one: it has shipped under `BytedanceWebview`, `musical_ly`
 * (the pre-rebrand app id, still present), `trill` (the international build) and
 * `TTWebView` across versions, so all four are matched rather than betting on
 * whichever is current this month.
 */
const IN_APP_PATTERNS: readonly RegExp[] = [
  // TikTok / ByteDance
  /BytedanceWebview/i,
  /musical_ly/i,
  // NOTE: no trailing \b — the real UA is `trill_2022905030`, and `_` is a word
  // character, so a closing boundary never fires. Leading \b still prevents
  // matching `trill` inside a longer word.
  /\btrill/i,
  /TTWebView/i,
  // Meta — Instagram, Facebook, Messenger
  /Instagram/i,
  /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i,
  // Other social sources that show up in link-in-bio traffic
  /Snapchat/i,
  /LinkedInApp/i,
  /Pinterest/i,
  /\bTwitter\b/i,
  /MicroMessenger/i, // WeChat
  /\bLine\//i,
];

/**
 * Generic Android WebView marker. Android stamps `; wv)` into the UA of any
 * WebView-hosted page, which catches in-app browsers we have no named pattern
 * for. There is no iOS equivalent — WKWebView is indistinguishable from Safari
 * by UA alone, which is why the named list above carries the weight on iOS.
 */
const ANDROID_WEBVIEW = /;\s*wv\)/i;

/** True when the UA belongs to an embedded webview rather than a real browser. */
export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  if (ANDROID_WEBVIEW.test(userAgent)) return true;
  return IN_APP_PATTERNS.some((re) => re.test(userAgent));
}

/**
 * Whether to offer "Continue with Google" at all.
 *
 * Rendering the button in a context where Google will reject it is worse than
 * omitting it: the visitor taps the most prominent control on the screen and
 * lands on a Google error page, mid-funnel, with no way back but the app's back
 * gesture. Hide it and let the OTP path — which works everywhere — carry them.
 */
export function isGoogleOAuthAvailable(userAgent: string | null | undefined): boolean {
  return !isInAppBrowser(userAgent);
}

/** Browser-side convenience. Returns false during SSR, where there is no navigator. */
export function isInAppBrowserClient(): boolean {
  if (typeof navigator === "undefined") return false;
  return isInAppBrowser(navigator.userAgent);
}
