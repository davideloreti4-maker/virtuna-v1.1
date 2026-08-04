/**
 * Shared off-surface navigation targets for the marketing landing.
 *
 * Single source of truth for every CTA destination so the URL is trivially
 * changeable in one place (CONTEXT D-20). The header "Try it free" / "Sign in"
 * and every later-phase CTA reference these constants — no hardcoded paths.
 */

/**
 * Where the marketing landing's CTAs actually send people.
 *
 * Owner call, 2026-08-04. Every marketing CTA pointed at `/signup`, which is a bare
 * email-and-password form with no money moment anywhere in it — while `/go`, the page designed
 * to convert, sat on its own carrying the free Test, the sealed verdict and the $1 wall.
 * DESIGN §6.1 already says "/go now carries 100% of conversion"; the landing page had simply
 * never been pointed at it.
 *
 * `/signup` is unchanged and still reachable (SIGNUP_URL below, /login links to it, and it is
 * the funnel-A door for anyone who wants an account directly) — it is just no longer the thing
 * a cold visitor is pushed toward.
 */
export const MARKETING_CTA_URL = "/go";

/**
 * The account-creation form. No longer the marketing CTA target (see MARKETING_CTA_URL) but
 * still the destination for "create an account" links from /login and anywhere a visitor has
 * asked for signup specifically rather than for the product.
 */
export const SIGNUP_URL = "/signup";

/** Secondary link target — "Sign in" → app login. */
export const LOGIN_URL = "/login";
