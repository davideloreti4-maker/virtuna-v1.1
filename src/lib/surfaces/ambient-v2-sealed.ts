/**
 * ambient-v2-sealed.ts — the sealed Detail drill an anonymous visitor's Simulate door
 * opens (ONBOARDING-FUNNEL-DESIGN.md §0b② — THE WALL).
 *
 * The walkthrough's `sealTemplate` stripped `unlock` / `brain.whyThisSecond` /
 * `population` from a template the client already held — acceptable for a public
 * fixture, not for the visitor's own run. On the live path the seal happened SERVER-side
 * (lib/onboarding/verdict-seal.ts): the wire seal carries only `analysisId` +
 * `craftScore`, so this builder is honest by construction — it cannot render what was
 * never transmitted.
 *
 * The verdict chip carries the CRAFT score — the free half, already on the visitor's
 * Test card (sealTemplate's own move: "behind the wall the hero carries the craft score
 * instead, so the figure never reads as an empty state"). `brain` is absent and
 * `population` is null, so `AmbientDetail` renders its honest withheld notes; the copy
 * below says WITHHELD, not "no run yet" — the run happened, the verdict is sealed.
 * No price in the copy: the $1 CTA belongs to the checkout surface, not this module.
 */

import type { DomainTemplate } from "@/components/audience-lens/v2/domain-template";

/** The brain tab's sealed line — names what exists and why it is not shown. */
export const SEALED_BRAIN_NOTE =
  "The brain read is done — why this second wins or loses. It unlocks with the simulation verdict.";

/** The audience tab's sealed line — the §0b wall sentence, not the no-run sentence. */
export const SEALED_POPULATION_NOTE =
  "Your audience's reaction is sealed. Unlock the simulation to open the room.";

/** The free half of a sealed video seal — the only inputs this builder accepts. */
export interface SealedVideoTemplateInput {
  craftScore: number | null;
}

/**
 * The sealed drill's template: craft chip, no unlock, no brain, null population —
 * `templateIsSealed` below is the contract, asserted on the RENDERED object in tests.
 */
export function buildSealedVideoDomainTemplate(
  input: SealedVideoTemplateInput,
): DomainTemplate {
  return {
    id: "creator",
    label: "Creator · content",
    backLabel: "Overview",
    pager: "video",
    verdict:
      input.craftScore != null
        ? { value: String(Math.round(input.craftScore)), label: "craft score" }
        : { value: "—", label: "craft score" },
    population: null,
  };
}

/** True when nothing the $1 buys is present — the same contract the walkthrough's
 *  `isSealed` asserts, restated here for the live surface. */
export function templateIsSealed(template: DomainTemplate): boolean {
  return (
    template.unlock === undefined &&
    // The answer block carries the verdict AND the lever; the engagement frame is the retention
    // instrument. Both are what the dollar buys, so a sealed template must not carry either.
    template.answer === undefined &&
    template.engagement === undefined &&
    template.brain?.whyThisSecond === undefined &&
    template.population === null
  );
}
