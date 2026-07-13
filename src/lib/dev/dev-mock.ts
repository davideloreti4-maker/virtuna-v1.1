/**
 * Dev mock mode — the gate for the zero-cost skill sandbox.
 *
 * TWO independent switches, BOTH hard-gated to non-production so nothing here can ever
 * activate on the deployed app (even a forged cookie is ignored when NODE_ENV==='production'):
 *
 *   1. isDevMockAllowed()      — is the whole feature available? (dev/test only)
 *      Gates the /api/dev/mock/* routes (they 404 in prod) and the DevMockPanel (unmounted).
 *
 *   2. isMockSkillsEnabled()   — is the LIVE skill short-circuit on right now?
 *      Read per-request by the /api/tools/* routes: when true they replay canned fixtures
 *      instead of calling the runner (no Qwen / Apify). Driven by the `numen_mock` cookie
 *      so the in-app toggle can flip it without a restart.
 *
 * The seed (preloaded populated thread) does NOT require switch #2 — it only writes fixture
 * blocks to the open thread. Switch #2 is purely for re-triggering skills live for free.
 */

/** The cookie the in-app toggle sets/clears to arm the live skill short-circuit. */
export const MOCK_COOKIE = "numen_mock";

/** True only outside production — the master gate for the entire dev-mock feature. */
export function isDevMockAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Whether the live skill short-circuit is armed for this request. Always false in prod.
 * `cookieValue` is the raw `numen_mock` cookie value (pass from next/headers cookies()).
 */
export function isMockSkillsEnabled(cookieValue: string | undefined): boolean {
  return isDevMockAllowed() && cookieValue === "1";
}
