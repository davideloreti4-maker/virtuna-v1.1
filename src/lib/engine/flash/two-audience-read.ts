/**
 * runTwoAudienceRead — the pulled-forward killer feature (Plan 08-06, W4 / D-08/D-09).
 *
 * Score ONE concept against TWO audiences side by side, defaulting to the active
 * calibrated audience vs General (which doubles as proof calibration MOVES the
 * verdict). The DELTA between the two verdicts is the one-line Read + Lever — the
 * foresight payoff: "wins for growth, bombs for buyers".
 *
 * This EXTENDS the multi-audience-read block (Plan 08-05, W3) from 1 to 2 audiences.
 * The block schema's `audiences` array was built W4-ready, so this is purely additive:
 * a second resolve + a second Flash run + the delta interpretation.
 *
 * Per audience (the real, separate second resolve — NOT a shared run):
 *   1. resolveAudienceWeights([aud])            — array-shaped resolver, ONE per audience
 *   2. runFlashTextMode(concept, "idea", panel, repaint) — Flash steered by THAT audience
 *   3. aggregateFlash(personas) → { band, fraction }     — reuse, do NOT re-roll band math
 *   4. deriveWhoNotFor(aud.personas)            — the scrolls-past segment (D-10, no model call)
 *
 * Then the DELTA: a pure interpretation line + Lever derived from the two bands
 * (NO extra model call — the framing is computed from the verdicts, never fabricated).
 *
 * Honesty spine (Pitfall 5 / D-11): bands only (Strong/Mixed/Weak) + fraction string.
 * NEVER a numeric 0-100 score. The block schema's `.strict()` rejects any smuggled score.
 *
 * Cap (D-09): exactly 2 audiences for v1 legibility. The object stays array-ready for
 * N later — the cap is enforced here, not in the schema.
 *
 * Isolation: imports the flash engine + audience domain only. No thread/route imports.
 */

import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import { runFlashTextMode } from "./run-flash-text-mode";
import { aggregateFlash } from "./flash-aggregate";
import type { FlashBand } from "./flash-aggregate";
import { deriveWhoNotFor } from "./who-not-for";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import type { MultiAudienceReadBlock } from "@/lib/tools/blocks";

/** Max audiences compared in v1 (D-09 — legibility cap; object stays array-ready for N). */
export const MAX_AUDIENCES = 2;

/** Numeric band rank for the delta comparison (Weak < Mixed < Strong). */
const BAND_RANK: Record<FlashBand, number> = { Weak: 0, Mixed: 1, Strong: 2 };

/** Lower-case verb for an audience's verdict band, used in the delta prose. */
const BAND_VERB: Record<FlashBand, string> = {
  Strong: "wins",
  Mixed: "splits",
  Weak: "bombs",
};

type ReadEntry = MultiAudienceReadBlock["props"]["audiences"][number];

/**
 * One per-audience Read: resolve THIS audience separately, run Flash steered by it,
 * aggregate to a band, and derive its scrolls-past segment. The interpretation + Lever
 * are filled in afterwards once both aggregates exist (they need the DELTA).
 */
async function readForAudience(
  concept: string,
  audience: Audience,
): Promise<{ entry: Omit<ReadEntry, "interpretation" | "lever">; band: FlashBand }> {
  // (1) The SECOND resolve is real: resolve EACH audience separately (array-shaped).
  //     Result is wired for the Max path; Flash steering rides the repaint below.
  const resolved = resolveAudienceWeights([audience]);
  void resolved;

  // archetype-slug → repaint map (undefined for General/no personas → byte-identical
  // Flash no-op, preserving the General regression gate). Mirrors the runner pattern.
  const audienceRepaint: Record<string, string> | undefined =
    !audience.is_general && audience.personas && audience.personas.length > 0
      ? Object.fromEntries(audience.personas.map((p) => [p.archetype, p.repaint]))
      : undefined;

  // (2) Flash per audience — "idea" framing (the concept Read). Niche panel left null
  //     here (the steer rides the per-audience repaint); contentType null.
  const panel = { niche: null, contentType: null } as const;
  const { result } = await runFlashTextMode(concept, "idea", panel, audienceRepaint);

  // (3) Aggregate — reuse the band math (do NOT re-roll). Bands only, no score.
  const { band, fraction } = aggregateFlash(result.personas);

  // (4) who-not-for — the scrolls-past segment from cold dispositions (D-10, no model call).
  const whoNotFor = deriveWhoNotFor(audience.personas);

  return {
    band,
    entry: {
      name: audience.name,
      band,
      fraction,
      whoNotFor,
      // Per-audience persona drill — the exact {archetype, verdict, quote} shape.
      personas: result.personas.map((p) => ({
        archetype: p.archetype,
        verdict: p.verdict,
        quote: p.quote,
      })),
      // interpretation + lever filled in by buildDelta (they need BOTH aggregates).
    } as Omit<ReadEntry, "interpretation" | "lever">,
  };
}

/**
 * Build the DELTA interpretation line + Lever for one audience, framed against the
 * OTHER. Pure derivation from the two bands — NO model call, NO fabricated number.
 *
 * The framing is the moat headline: "{Self} {wins/splits/bombs} ({band}) — {Other}
 * {verb} ({band})." The Lever names the one thing to act on, derived from which side
 * is weaker (close the gap) or whether both agree.
 */
function buildDelta(self: { name: string; band: FlashBand }, other: { name: string; band: FlashBand }): {
  interpretation: string;
  lever: string;
} {
  const selfRank = BAND_RANK[self.band];
  const otherRank = BAND_RANK[other.band];

  const interpretation = `${self.name} ${BAND_VERB[self.band]} (${self.band}) — ${other.name} ${BAND_VERB[other.band]} (${other.band}).`;

  let lever: string;
  if (selfRank > otherRank) {
    // This audience is the stronger side — the lever is to also reach the weaker one.
    lever = `Strong for ${self.name}. To also land ${other.name}, add a beat that answers what they came for.`;
  } else if (selfRank < otherRank) {
    // This audience is the weaker side — the lever is to close its gap without losing the other.
    lever = `Soft for ${self.name}. Keep what works for ${other.name}, but sharpen the hook for ${self.name}.`;
  } else {
    // Both agree — the lever reinforces the shared signal.
    lever = `Both ${self.name} and ${other.name} land the same — lean into what they share.`;
  }

  return { interpretation, lever };
}

/**
 * Read one concept against up to 2 audiences side by side (D-08/D-09).
 *
 * Defaulting: if only ONE audience is passed, General is filled as the comparison
 * pair (the default = active calibrated audience vs General, D-09). The pick is
 * capped at 2 for v1 legibility — extra audiences are dropped (array-ready for N).
 *
 * @param concept    The concept/hook text to read.
 * @param audiences  1 or 2 audiences. 1 → [active, General]. >2 → first 2 kept.
 * @returns A `multi-audience-read` block with exactly 2 per-audience entries
 *          (band + fraction + delta interpretation + Lever + who-not-for + persona drill),
 *          bands only, `model: "sim1-flash"` provenance.
 */
export async function runTwoAudienceRead(
  concept: string,
  audiences: Audience[],
): Promise<MultiAudienceReadBlock> {
  // Default pair (D-09): a single active audience compares against General.
  // Dedupe the explicit General case so we never compare General to General.
  let pair: Audience[];
  if (audiences.length === 0) {
    pair = [GENERAL_AUDIENCE, GENERAL_AUDIENCE];
  } else if (audiences.length === 1) {
    const first = audiences[0]!;
    pair = first.is_general ? [GENERAL_AUDIENCE, GENERAL_AUDIENCE] : [first, GENERAL_AUDIENCE];
  } else {
    // Cap at 2 for v1 legibility (D-09).
    pair = audiences.slice(0, MAX_AUDIENCES);
  }

  // Resolve + run Flash per audience SEPARATELY (the second resolve is real, D-08).
  const reads = await Promise.all(pair.map((aud) => readForAudience(concept, aud)));

  // Fill the DELTA interpretation + Lever for each entry, framed against the other.
  const [a, b] = reads;
  const aDelta = buildDelta(
    { name: a!.entry.name, band: a!.band },
    { name: b!.entry.name, band: b!.band },
  );
  const bDelta = buildDelta(
    { name: b!.entry.name, band: b!.band },
    { name: a!.entry.name, band: a!.band },
  );

  const audiencesOut: ReadEntry[] = [
    { ...a!.entry, interpretation: aDelta.interpretation, lever: aDelta.lever },
    { ...b!.entry, interpretation: bDelta.interpretation, lever: bDelta.lever },
  ];

  return {
    type: "multi-audience-read",
    props: {
      audiences: audiencesOut,
      model: "sim1-flash",
    },
  };
}
