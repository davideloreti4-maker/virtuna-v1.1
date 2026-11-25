/**
 * cookies.ts — the referral cookies, as the server names and reads them (Earn, rulings 29 and 30). Pure:
 * the middleware (edge), the sign-in callback and the checkout share it.
 *
 * - `virtuna_referral` (`REFERRAL_COOKIE_NAME`): the code of the first link a visitor opened.
 * - `virtuna_referral_at` (`REFERRAL_AT_COOKIE_NAME`): when that link was first opened (ISO), set by the
 *   middleware together with the code and never written while the code's cookie exists.
 *
 * Whoever reads them checks what they say: the form of the code (`isReferralCode`), and the time against
 * the buyer's account (`src/lib/earn/referrer-of.ts`).
 */
import { REFERRAL_COOKIE_NAME } from "./constants";

/** The time the link was first opened. A separate module from `constants.ts` on purpose: its name follows the code's cookie. */
export const REFERRAL_AT_COOKIE_NAME = `${REFERRAL_COOKIE_NAME}_at`;

/**
 * One cookie's value from a request's `Cookie` header, decoded (a cookie set through `NextResponse` is
 * percent-encoded). The first one of that exact name; undefined when it is absent or cannot be decoded.
 */
export function cookieOf(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at === -1 || part.slice(0, at).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
