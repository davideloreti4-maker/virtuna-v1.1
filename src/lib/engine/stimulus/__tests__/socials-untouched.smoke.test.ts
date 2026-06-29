/**
 * D-02 structural smoke — the Socials path is UNCHANGED by the Phase 4 General
 * input adapter (GREEN now).
 *
 * The `Stimulus` adapter is purely additive. This light STRUCTURAL smoke locks
 * the two guarantees that matter for D-02 / T-04-01-02:
 *   1. `normalizeInput` still returns a `ContentPayload`-shaped object for a text
 *      `AnalysisInput` (the Socials normalization is byte-untouched).
 *   2. `SOCIALS_PACK.stimulusTypes` still deep-equals the original three kinds —
 *      Socials does NOT gain `file_text` / `image` (those live on the future
 *      General pack; the `StimulusType` *type* widened, the Socials *list* did not).
 *
 * Deliberately NOT byte-golden — it guards against accidental Socials-path edits,
 * not against intentional refactors of unrelated fields.
 *
 * Runner: `node ./node_modules/vitest/vitest.mjs run` (NEVER npm test / npx vitest
 * — they print fake PASS(0)/FAIL(0) in this repo).
 */
import { describe, it, expect } from "vitest";

import { normalizeInput } from "../../normalize";
import type { AnalysisInput } from "../../types";
import { SOCIALS_PACK } from "../../packs/socials";

describe("D-02: Socials path untouched by the General input adapter", () => {
  it("normalizeInput still returns a ContentPayload-shaped object for text input", () => {
    const input: AnalysisInput = {
      input_mode: "text",
      content_text: "hello #world",
      content_type: "post",
      mode: "score",
    };

    const payload = normalizeInput(input);

    // Structural shape of ContentPayload (types.ts:205-216) — not byte-golden.
    expect(payload).toMatchObject({
      content_text: "hello #world",
      content_type: "post",
      input_mode: "text",
      video_url: null,
      video_storage_path: null,
    });
    expect(Array.isArray(payload.hashtags)).toBe(true);
    expect(payload.hashtags).toContain("#world");
    expect(payload).toHaveProperty("duration_hint");
    expect(payload).toHaveProperty("niche");
    expect(payload).toHaveProperty("creator_handle");
    expect(payload).toHaveProperty("society_id");
  });

  it("SOCIALS_PACK.stimulusTypes is unchanged — Socials does NOT gain file_text/image", () => {
    expect([...SOCIALS_PACK.stimulusTypes]).toEqual([
      "text",
      "tiktok_url",
      "video_upload",
    ]);
    expect(SOCIALS_PACK.stimulusTypes).not.toContain("file_text");
    expect(SOCIALS_PACK.stimulusTypes).not.toContain("image");
  });
});
