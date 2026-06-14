/**
 * Shared off-surface navigation targets for the marketing landing.
 *
 * Single source of truth for every CTA destination so the URL is trivially
 * changeable in one place (CONTEXT D-20). The header "Try it free" / "Sign in"
 * and every later-phase CTA reference these constants — no hardcoded paths.
 */

/** Primary CTA target — "Try it free" → app signup. */
export const SIGNUP_URL = "/signup";

/** Secondary link target — "Sign in" → app login. */
export const LOGIN_URL = "/login";
