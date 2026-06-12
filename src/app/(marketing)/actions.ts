"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * actions.ts — CTA-02 joinWaitlist server action (D-01/D-02).
 *
 * Mirrors `src/app/(onboarding)/signup/actions.ts` (`"use server"`, `createClient`
 * from `@/lib/supabase/server`, `formData.get` + `{ error }` destructure) but DROPS
 * `redirect` — the waitlist form shows inline success/error via `useActionState`
 * instead of navigating away from the landing.
 *
 * Security (threat register T-03-08/09/10):
 *  - Honeypot `company`: a hidden field bots fill, humans never → silent success,
 *    no insert (DoS floor, D-02).
 *  - Server-side email validation (EMAIL_RE) BEFORE any insert (V5 input validation).
 *  - Unique-violation 23505 → identical success state (dup-as-success, no
 *    enumeration leak / information disclosure — T-03-08, D-02).
 *  - `source` resolved from a server-side literal allowlist (only two values),
 *    NEVER trusted raw from the hidden field (T-03-10 tampering); DB CHECK backstop.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WaitlistState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  // Honeypot: a hidden field bots fill, humans never. Silent success on trip — no
  // insert, no error leak (the bot learns nothing).
  if ((formData.get("company") as string)?.trim()) {
    return { status: "success" };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();

  // Server-side literal allowlist — a tampered hidden field can't write arbitrary
  // values; the DB CHECK constraint is the backstop.
  const source =
    (formData.get("source") as string) === "landing-hero"
      ? "landing-hero"
      : "landing-footer-cta";

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").insert({ email, source });

  if (error) {
    // 23505 = unique_violation → already on the list. Treat as success; NEVER
    // reveal the email already exists (no enumeration leak, D-02 / T-03-08).
    if (error.code === "23505") return { status: "success" };
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  return { status: "success" };
}
