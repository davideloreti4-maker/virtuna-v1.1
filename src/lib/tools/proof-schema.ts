/**
 * proof-schema.ts — the shared grounding-receipt schema (HookProof), a zod LEAF.
 *
 * Extracted from blocks.ts (2026-07-21) so BOTH block modules can reference it without a
 * cycle: blocks.ts imports profile-blocks.ts (for the read/gauge/test schemas), and the
 * Test card (in profile-blocks.ts) needs the proof shape for its grounded director's-fixes.
 * A leaf with no dependency but zod is the one place both can import from.
 *
 * blocks.ts re-exports `HookProofSchema` / `HookProof` so every existing
 * `@/lib/tools/blocks` import site keeps working unchanged.
 */

import { z } from "zod";

// The durable, honest receipt for the real outlier video whose proven STRUCTURE a grounded
// output adapted. Mirrors grounding's RetrievedExample (lib/grounding/types.ts); the card
// renders "@handle · N× <basis> · views ↗". Numbers are nullable — we show only what we
// truly have (a caption-tier extraction may lack a durable multiplier), never a fabricated
// stat. fitLabel is the honest §11c per-request match (● in-audience / ◐ adjacent /
// ○ structural). handle is required — no receipt without a real, nameable source.
// (Named HookProofSchema for back-compat: hooks shipped it first; ideas/script/test reuse it.)
export const HookProofSchema = z.object({
  handle: z.string(),                                          // @creator of the proof video
  videoUrl: z.string().nullable(),                            // link to the proof (absent on some search-mode rows)
  coverUrl: z.string().nullable(),                            // ephemeral TikTok-CDN thumbnail (display-only; may expire → renderer hides on error)
  hookTemplate: z.string().nullable(),                       // the source hook as a [bracketed] fill-in-the-blank (Sandcastles-style proof line)
  archetype: z.string().nullable(),                          // source hook archetype slug (e.g. "secret-reveal-breakdown") → pill
  multiplier: z.number().nullable(),                          // durable outlier basis (views ÷ followers, finding #2)
  views: z.number().nullable(),
  baselineLabel: z.string().nullable(),                      // honest basis, e.g. "vs followers"
  /**
   * The §11c per-request audience match — NULLABLE (2026-07-13). A fit label is a claim that
   * a source was retrieved and scored against your audience, which is true of grounded
   * hook/idea/script sources and NOT of a Remix source: you pasted that video yourself, so
   * nothing measured its fit. Grounded runners still always set it; remix passes null and the
   * renderer then omits the glyph rather than asserting a match nobody computed.
   */
  fitLabel: z.enum(["in-audience", "adjacent", "structural"]).nullable(),
});
export type HookProof = z.infer<typeof HookProofSchema>;
