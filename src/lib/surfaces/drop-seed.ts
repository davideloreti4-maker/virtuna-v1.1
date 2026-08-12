/**
 * drop-seed.ts — a cached drop card → the seeded remix thread's turns (v8 Phase 2).
 *
 * Pure mapping, ZERO model calls: the 3 adapt concepts were computed by the daily
 * warm; tapping Remix only re-shapes them into the same ranked remix-card stack the
 * remix runner emits (remix-runner.ts:359 — same key order, same conditional spreads),
 * with two honest differences:
 *   - NO sourceDecode: the corpus row never ran the decode engine (schema optional).
 *   - proof always present, with multiplier/baselineLabel/fitLabel ALWAYS null —
 *     no corpus multiplier anywhere (owner call #1) and nothing scored the SOURCE
 *     against this audience.
 * The angles arrive UNSCORED (v8 rule): band/fraction are the adapt call's own
 * projection (provenance "projected"), personas/population never ride along.
 * Schema-invalid concepts drop via safeParse — mirror the runner, never pad.
 * A missing stopQuote is NOT schema-invalid: it maps to scrollQuote "" (legal,
 * renders quote-less) — an optional field the adapt model omitted must never
 * delete a whole angle from the seeded stack.
 */

import { bandFromStops } from "@/lib/engine/flash/flash-aggregate";
import { RemixCardBlockSchema } from "@/lib/tools/blocks";
import type { HookProof, RemixCardBlock } from "@/lib/tools/blocks";
import type { LiveDropCard } from "./live-cards";

function clampStops(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(10, Math.max(0, n));
}

/** The seeded thread's user turn. */
// v8 copy — owner reviews before launch (handoff §5).
export function dropUserTurnText(card: LiveDropCard): string {
  return `Remix this for me: "${card.hook}"`;
}

/**
 * The seeded assistant turn: one validated remix-card per concept, in the card's
 * ranked order (winner leading). Invalid concepts are dropped, never padded —
 * a caller receiving [] has nothing honest to seed and should fail the request.
 */
export function dropCardToRemixBlocks(
  card: LiveDropCard,
  audienceName?: string | null,
): RemixCardBlock[] {
  const proof: HookProof = {
    handle: card.handle.startsWith("@") ? card.handle : `@${card.handle}`,
    videoUrl: card.videoUrl,
    coverUrl: card.coverUrl,
    hookTemplate: card.hookTemplate,
    archetype: card.archetype,
    // Owner ruling 2026-08-10: the multiplier PRINTS, basis = the corpus baseline
    // ("vs their usual views"). Old cached cards predate the field → null (omitted).
    multiplier: typeof card.multiplier === "number" ? card.multiplier : null,
    views: card.viewsRaw > 0 ? card.viewsRaw : null,
    baselineLabel: card.baselineLabel ?? null,
    fitLabel: null, // nothing scored this SOURCE against the audience
  };

  const blocks: RemixCardBlock[] = [];
  for (const concept of card.concepts) {
    const stops = clampStops(concept.personaStops);
    const blockData = {
      type: "remix-card" as const,
      props: {
        adaptedHook: concept.hook,
        angle: concept.angle,
        whoItsFor: concept.who_its_for,
        formatBorrowed: concept.format_borrowed,
        ...(concept.production ? { production: concept.production } : {}),
        proof,
        band: bandFromStops(stops),
        fraction: `${stops}/10 stop`,
        scrollQuote: concept.stopQuote?.trim() ?? "",
        model: "sim1-flash" as const,
        provenance: "projected" as const,
        ...(audienceName ? { audienceName } : {}),
        // sourceDecode / personas / population INTENTIONALLY OMITTED — no decode ran,
        // no sim fired; the shelf meter was the only pre-score (it stays on the shelf).
      },
    };
    const validated = RemixCardBlockSchema.safeParse(blockData);
    if (!validated.success) continue;
    blocks.push(validated.data as RemixCardBlock);
  }
  return blocks;
}
