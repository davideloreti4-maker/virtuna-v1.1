/**
 * The facts of You that remix takes (plan 2026-11-24-you, spec §5): never, what they sell, about
 * them, how they sound. Each is read through `youFact` (trimmed, clean of the fence's markers, cut to
 * its limit, null while the new look is off). What they can film is not taken: remix borrows the
 * source's shots.
 *
 * What they sell is taken only when the creator's brief (the text behind `MAKE IT ABOUT:`) asks to
 * sell (`asksToSell`, the controller's ruling 15): in real runs on the writers, wording alone pitched
 * the offer in asks that were not about it, or dropped it from asks that were. With no brief the
 * prompt has no `MAKE IT ABOUT` line, and the offer is never printed.
 *
 * Null when none of the four is there to print, so the adapt prompt is exactly what it was.
 */
import type { RemixCreatorFacts } from "@/lib/engine/remix/decode-types";
import { asksToSell } from "@/lib/kc/asks-to-sell";
import { youFact, type ProfileRow } from "@/lib/kc/profile-role-map";

export function remixCreatorOf(row: ProfileRow | null, brief: string | null | undefined): RemixCreatorFacts | null {
  const sells = youFact(row, "sells");
  const facts: RemixCreatorFacts = {
    never: youFact(row, "never_do"),
    sells: sells !== null && brief && asksToSell(brief, sells) ? sells : null,
    about: youFact(row, "about"),
    voice: youFact(row, "writing_voice_description"),
  };
  return Object.values(facts).some((value) => value !== null) ? facts : null;
}
