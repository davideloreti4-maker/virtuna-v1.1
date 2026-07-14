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

import { buildFlashWeighting } from "@/lib/engine/flash/persona-weighting";
import type { DomainLens } from "@/lib/engine/flash/run-flash-text-mode";
import { runFlashTextMode } from "./run-flash-text-mode";
import { aggregateFlash } from "./flash-aggregate";
import type { FlashBand } from "./flash-aggregate";
import { deriveWhoNotFor } from "./who-not-for";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { resolveTier } from "@/lib/audience/resolve-tier";
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

/** The same verbs for a `mode: 'general'` panel, which judges a case rather than a feed (MODE-01). */
const GENERAL_BAND_VERB: Record<FlashBand, string> = {
  Strong: "is convinced",
  Mixed: "is split",
  Weak: "isn't convinced",
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
  // (1) The audience's WEIGHT MIX (persona_weights → analysis_override) weights the band,
  //     exactly as it does in the hooks/ideas/script/remix runners.
  //
  //     MODE-01: this used to be `resolveAudienceWeights([audience]); void resolved;` — computed,
  //     then thrown away. Together with the dropped repaint (below) it meant NOTHING about the
  //     audience reached the model or the band, so the /audience workspace's mix sliders moved
  //     every other skill but were inert on the Read. buildFlashWeighting returns undefined for
  //     General and for any audience without an analysis_override → the regression gate holds.
  const weighting = buildFlashWeighting(audience);

  // archetype-slug → repaint map (undefined for General/no personas → byte-identical
  // Flash no-op, preserving the General regression gate). Mirrors the runner pattern.
  const audienceRepaint: Record<string, string> | undefined =
    !audience.is_general && audience.personas && audience.personas.length > 0
      ? Object.fromEntries(audience.personas.map((p) => [p.archetype, p.repaint]))
      : undefined;

  // (2) The reaction FRAME (MODE-01). A `mode: 'general'` audience — an analyst panel, a hiring
  //     panel, one named person — is not a TikTok crowd, so it must not be asked the FYP
  //     stop-or-scroll question. The verdict tokens are unchanged; their MEANING is re-aimed.
  const domain: DomainLens = audience.mode === "general" ? "general" : "socials";

  // (3) Flash per audience — "idea" framing (the concept Read). Niche panel left null here;
  //     the steer rides the per-audience repaint, which the generic prompt now honours.
  const panel = { niche: null, contentType: null } as const;
  const { result } = await runFlashTextMode(
    concept,
    "idea",
    panel,
    audienceRepaint,
    undefined,
    domain,
  );

  // (4) Aggregate — reuse the band math (do NOT re-roll). Bands only, no score.
  //     `fraction` stays the honest raw count; the weighting moves only the qualitative band.
  const { band, fraction } = aggregateFlash(result.personas, weighting);

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
 * Defaulting: if only ONE distinct audience is passed, General is filled as the
 * comparison pair (the default = active calibrated audience vs General, D-09). The
 * pick is capped at 2 for v1 legibility — extra audiences are dropped (array-ready
 * for N).
 *
 * Identity dedupe (CR-02): audiences are deduped by `id` BEFORE defaulting. When the
 * two resolved audiences are the SAME audience (e.g. the common default where no
 * calibrated audience is pinned → [General, General]), the result collapses to a
 * SINGLE-audience Read rather than a degenerate self-compare ("Both General and
 * General land the same"). A genuine compare requires two distinct audiences.
 *
 * @param concept    The concept/hook text to read.
 * @param audiences  1 or 2 audiences. 1 → [active, General]. >2 → first 2 kept.
 *                   Same-identity pairs collapse to a single-audience Read.
 * @returns A `multi-audience-read` block with 1 entry (same-identity / single-audience
 *          case) or 2 per-audience entries (genuine compare) — each carrying
 *          band + fraction + interpretation + Lever + who-not-for + persona drill,
 *          bands only, `model: "sim1-flash"` provenance.
 */
export async function runTwoAudienceRead(
  concept: string,
  audiences: Audience[],
): Promise<MultiAudienceReadBlock> {
  // ── Dedupe by audience IDENTITY first (CR-02) ──────────────────────────────
  // The route ALWAYS passes a 2-element [active, second] array, so a length check
  // is not enough: the common default (no calibrated audience pinned, no explicit
  // second pick) resolves to [General, General]. Comparing General-to-General
  // renders a degenerate "General: Strong · General: Strong / Both General and
  // General land the same" Read. Collapse same-identity pairs to ONE audience BEFORE
  // defaulting, so the dedupe fires regardless of array length.
  const distinct: Audience[] = [];
  const seenIds = new Set<string>();
  for (const aud of audiences.slice(0, MAX_AUDIENCES)) {
    if (!seenIds.has(aud.id)) {
      seenIds.add(aud.id);
      distinct.push(aud);
    }
  }

  // ── MODE-01 — the control rule: drop any audience the LEAD is not comparable to ──
  //
  // GENERAL_AUDIENCE is `mode: 'socials'`, `platform: 'tiktok'` (audience-repo.ts:38-47). It is a
  // TikTok crowd, NOT a neutral control. Pairing an analyst panel or a named person against it
  // printed a confident band on a comparison that means nothing — live, before this fix:
  //   "Marcus Reyes splits (Mixed) — General splits (Mixed)."
  //   "Both Marcus Reyes and General land the same — lean into what they share."
  //
  // The two sides are asked DIFFERENT QUESTIONS (would you scroll past · are you convinced), so a
  // delta between their bands is an artifact of the frame, not a fact about the concept.
  //
  // This filter runs on the DEDUPED list, BEFORE defaulting, because the route always hands us a
  // 2-element [active, second] array — a length check would never catch the real shape (the bug a
  // unit test missed and a live run caught). A general-mode lead keeps only general-mode company;
  // everything else is dropped and it reads SINGLE (the self-pair collapse below).
  //
  // A general-mode CONTROL would have to be an authored general panel. That belongs to the General
  // pack (domain-pack.ts reserves the slot), not to this seam.
  const lead = distinct[0];
  const comparable = lead ? distinct.filter((a) => a.mode === lead.mode) : distinct;

  // Default pair (D-09): a single active audience compares against General.
  // Dedupe the explicit General case so we never compare General to General.
  let pair: Audience[];
  if (comparable.length === 0) {
    pair = [GENERAL_AUDIENCE, GENERAL_AUDIENCE];
  } else if (comparable.length === 1) {
    const first = comparable[0]!;
    if (first.is_general) {
      pair = [GENERAL_AUDIENCE, GENERAL_AUDIENCE];
    } else if (first.mode === "general") {
      // Self-pair → collapses to ONE honest entry below. Compared against nothing, because
      // there is nothing here it is comparable to.
      pair = [first, first];
    } else {
      pair = [first, GENERAL_AUDIENCE];
    }
  } else {
    // Two distinct, SAME-MODE audiences — the genuine compare path (panel-vs-panel or
    // crowd-vs-crowd). Cross-mode explicit pairs are also rejected upstream at the route
    // (400 audience_mode_mismatch) so the user gets an explanation, not a silent drop.
    pair = comparable;
  }

  // ── Single-audience Read (CR-02): both sides are the SAME identity ──────────
  // When the dedupe collapsed to a self-pair (e.g. the default General-only case),
  // present a single-audience Read — NOT a degenerate self-compare. One entry, no
  // delta framing against an identical "other" audience (which would read as the
  // dishonest "Both General and General land the same").
  const isSelfPair = pair[0]!.id === pair[1]!.id;
  if (isSelfPair) {
    const { entry, band } = await readForAudience(concept, pair[0]!);
    // No comparison audience → no delta. The interpretation states this audience's
    // verdict on its own terms; the lever points at the single verdict.
    //
    // MODE-01: the socials copy ("sharpen the hook", "tighten the opener", "wins/bombs") is FYP
    // language — it tells a panel of analysts to fix a scroll-stopper. A general-mode audience
    // gets copy about its own frame: the case either lands or it doesn't.
    const isGeneral = pair[0]!.mode === "general";
    const interpretation = isGeneral
      ? `${entry.name} ${GENERAL_BAND_VERB[band]} (${band}).`
      : `${entry.name} ${BAND_VERB[band]} (${band}).`;
    const lever = isGeneral
      ? band === "Strong"
        ? `Lands with ${entry.name}. The case holds — the panel is with you.`
        : band === "Weak"
          ? `${entry.name} isn't convinced. Answer the objection they keep raising, then re-read.`
          : `${entry.name} is split. Shore up the weakest claim to bring the holdouts over.`
      : band === "Strong"
        ? `Strong for ${entry.name}. Calibrate a second audience to see where it diverges.`
        : band === "Weak"
          ? `Soft for ${entry.name}. Sharpen the hook, then re-read.`
          : `Mixed for ${entry.name}. Tighten the opener to push it toward Strong.`;
    return {
      type: "multi-audience-read",
      props: {
        audiences: [{ ...entry, interpretation, lever }],
        model: "sim1-flash",
        // Run-level honesty tier (TRUST-01) — the ACTIVE audience is the lead (pair[0]).
        // Presentation-only; resolveTier is the single source of truth (never-Validated-
        // for-general rule, T-03-15). Self-pair: lead === the single audience.
        tier: resolveTier(pair[0]!),
      },
    };
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
      // Run-level honesty tier (TRUST-01) — derived from the ACTIVE/lead audience
      // (pair[0]). Presentation-only; resolveTier owns the never-Validated-for-general
      // rule (T-03-15). The badge rides the run, not a per-audience entry.
      tier: resolveTier(pair[0]!),
    },
  };
}
