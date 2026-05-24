/**
 * Stub test file for src/lib/engine/optimal-post.ts helper (D-15 — Plan 01-05).
 *
 * Plan 01-01 ships placeholders; Plan 01-05 fills assertions.
 */
import { describe, it } from "vitest";

describe("computeOptimalPostWindow", () => {
  it.todo("computeOptimalPostWindow returns FALLBACK when niche=null");
  it.todo("computeOptimalPostWindow returns row from niche_post_windows when niche match");
  it.todo("computeOptimalPostWindow returns FALLBACK when no row matches");
  it.todo("computeOptimalPostWindow returns null on Supabase error (non-fatal)");
  it.todo("FALLBACK has source='fallback' and a defensible default day/hour");
});
