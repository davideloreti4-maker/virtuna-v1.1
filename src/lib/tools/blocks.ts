/**
 * Block schemas + TypeScript types for the typed-block renderer system (THREAD-04).
 *
 * Each block is shaped { type: z.literal(...), props: z.object({...}) }.
 * These schemas are the SSOT consumed by:
 *  - block-registry.ts (schema half, server-importable)
 *  - block-registry.tsx (component half, client)
 *  - tool-runner.ts (assertBlocksInRegistry at the output boundary)
 *  - message-blocks.tsx (re-validate on rehydration, D-14)
 *
 * Design constraints:
 *  - BandBlock carries NO numeric score (D-02/D-11 honesty spine).
 *  - BandBlock carries a model tag (sim1-flash | sim1-max) for provenance (D-10).
 *  - PersonasBlock shape matches the exact {archetype, verdict, quote} D-03 spec.
 */

import { z } from "zod";

// ─── Markdown block ───────────────────────────────────────────────────────────

export const MarkdownBlockSchema = z.object({
  type: z.literal("markdown"),
  props: z.object({
    text: z.string(),
  }),
});

export type MarkdownBlock = z.infer<typeof MarkdownBlockSchema>;

// ─── Band block ───────────────────────────────────────────────────────────────
// D-02: band word + audience fraction only — NO 0-100 number (D-11 honesty spine).
// D-10: model tag lives ON the block so provenance survives scroll-away.
// D-10: Flash and Max MUST use distinct band styling (enforced in band-block.tsx).

export const BandBlockSchema = z.object({
  type: z.literal("band"),
  props: z.object({
    band: z.enum(["Strong", "Mixed", "Weak"]),
    fraction: z.string(),                            // e.g. "6/10 stop"
    model: z.enum(["sim1-flash", "sim1-max"]),       // provenance tag (D-10)
  }),
});

export type BandBlock = z.infer<typeof BandBlockSchema>;

// ─── Personas block ───────────────────────────────────────────────────────────
// D-03: each persona returns a stop/scroll verdict + a first-person voice quote.
// This is also the exact data shape custom personas will emit later (v6.1+, D-05).

export const PersonasBlockSchema = z.object({
  type: z.literal("personas"),
  props: z.object({
    personas: z.array(
      z.object({
        archetype: z.string(),
        verdict: z.enum(["stop", "scroll"]),
        quote: z.string().min(1).max(160),
      }),
    ),
  }),
});

export type PersonasBlock = z.infer<typeof PersonasBlockSchema>;

// ─── Union ────────────────────────────────────────────────────────────────────

export const BlockUnionSchema = z.discriminatedUnion("type", [
  MarkdownBlockSchema,
  BandBlockSchema,
  PersonasBlockSchema,
]);

export type BlockUnion = z.infer<typeof BlockUnionSchema>;
