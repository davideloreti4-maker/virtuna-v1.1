/**
 * card-rewrite — builds the `LensRewrite` descriptor the AudienceLens sticky
 * "Rewrite for this audience →" CTA consumes (LIVE-07, D-05), for the four
 * regenerable text card surfaces (idea / hook / script / remix).
 *
 * The flywheel that "IS the product": tapping Rewrite re-POSTs to the ORIGINATING
 * skill's OWN runner (the same SSE route the thread already streams from) with the
 * Read's LEVER injected as the steering `ask` and the prior concept carried as the
 * `anchor`. The runner persists the regenerated card + Read into the SAME open thread
 * (server-side) — so the new card surfaces through the existing thread stream / on the
 * next thread load. We REUSE the existing endpoint contract (CHAIN_HANDOFFS self-handoff
 * + the pinned { ask?, anchor?, platform } payload) rather than inventing a new pipeline.
 *
 * Endpoint is sourced from `handoffsFor(skill)` — the SSOT self-handoff entry
 * (from===to, ctaLabel "Rewrite for this audience →"). We NEVER hard-code the route.
 *
 * Honesty (D-02 spine):
 *  - The lever IS the audience's real verbatim reaction (the card's lead `scrollQuote`),
 *    never a fabricated instruction.
 *  - priorStopCount/priorTotal are parsed from the card's REAL `fraction` (e.g. "6/10 stop").
 *  - `onRewrite` returns the new Read's delta ONLY if the runner echoes it synchronously;
 *    otherwise it returns null (the Lens then shows no fabricated delta — the regenerated
 *    card still streams into the thread). No invented stop/total.
 *
 * Pure builder — no React. The `onRewrite` it returns performs the fetch.
 */

import type { LensRewrite } from './AudienceLens';
import { handoffsFor, type SkillId } from '@/lib/tools/chain-handoff';

/** Parse "6/10 stop" → { stopCount: 6, total: 10 }. Returns null on any unexpected shape. */
function parseFraction(fraction: string): { stopCount: number; total: number } | null {
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const stopCount = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(stopCount) || !Number.isFinite(total) || total <= 0 || stopCount > total) {
    return null;
  }
  return { stopCount, total };
}

export interface BuildCardRewriteArgs {
  /** The originating skill that owns the card (idea / hooks / script / remix). */
  skill: SkillId;
  /** The card's real band fraction (e.g. "6/10 stop") — drives the prior delta readout. */
  fraction: string;
  /** The card's lead scroll-quote — the audience's REAL verbatim reaction, used as the lever. */
  scrollQuote: string;
  /** The prior concept text being regenerated (carried as the re-POST `anchor`). */
  conceptText: string;
  /** Platform carried on the re-POST (matches the runner contract). */
  platform: string;
  /**
   * When true, the lever rides the `anchor` instead of `ask` (the remix self-handoff
   * targets /api/tools/ideas/develop, which reads ONLY { anchor, platform } and ignores
   * `ask` — A2 minimal adjustment, chain-handoff.ts). The lever is then prepended to the
   * concept so the steering still reaches the runner. Default false (idea/hooks/script
   * accept `ask`).
   */
  leverRidesAnchor?: boolean;
}

/**
 * Build the `LensRewrite` for a regenerable card, or return undefined when the surface
 * is genuinely not regenerable (no self-handoff entry, or an unparseable fraction so we
 * cannot honestly show a prior count). Undefined ⇒ the Lens omits the sticky CTA (D-05).
 */
export function buildCardRewrite(args: BuildCardRewriteArgs): LensRewrite | undefined {
  const { skill, fraction, scrollQuote, conceptText, platform, leverRidesAnchor = false } = args;

  // The self-handoff entry (from===to) is the SSOT for this skill's Rewrite endpoint.
  const selfHandoff = handoffsFor(skill).find(
    (h) => h.to === skill && h.ctaLabel === 'Rewrite for this audience →',
  );
  if (!selfHandoff || !selfHandoff.endpoint) return undefined;
  const endpoint = selfHandoff.endpoint;

  const prior = parseFraction(fraction);
  if (!prior) return undefined;

  // The lever = the audience's REAL verbatim reaction (the lead scroll-quote). This is the
  // steering anchor the AudienceLens injects as `ask` on the re-POST (lever-as-steering).
  const lever = scrollQuote;

  return {
    endpoint,
    lever,
    platform,
    priorStopCount: prior.stopCount,
    priorTotal: prior.total,
    onRewrite: async (anchor, plat) => {
      // Re-POST to the originating skill's own runner with the lever as steering `ask`
      // and the prior concept as `anchor` — the pinned { ask?, anchor?, platform } contract
      // (CHAIN_HANDOFFS self-handoff). The runner persists the regenerated card + Read into
      // the SAME open thread, so the new card surfaces via the existing thread stream.
      try {
        // `anchor` arg IS the lever (the Lens passes rewrite.lever as the steering anchor).
        // For ask-accepting runners (idea/hooks/script): lever → `ask`, concept → `anchor`.
        // For the remix develop route (anchor-only): fold the lever INTO the anchor so the
        // steering still reaches the runner (A2 minimal adjustment, chain-handoff.ts).
        const payload = leverRidesAnchor
          ? { anchor: `${anchor}\n\n${conceptText}`.slice(0, 5000), platform: plat }
          : { ask: anchor, anchor: conceptText, platform: plat };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return null;
        // The new card + Read stream into the open thread server-side. We do NOT fabricate
        // a delta from an unparsed SSE stream — return null so the Lens shows no false
        // before/after number; the regenerated card itself is the honest result in-thread.
        return null;
      } catch {
        return null;
      }
    },
  };
}
