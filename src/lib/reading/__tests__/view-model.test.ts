/**
 * DATA-01 / DATA-03 / D-14 — block taxonomy + field-prune + degradation.
 *
 * RED state (Wave 0): `../view-model` does NOT exist yet (Wave 2 builds it).
 * Collected by vitest, FAILS until then — the expected Wave-0 state.
 *
 * Asserts:
 *  - DATA-01: a populated canonical input yields the value-bearing block kinds.
 *  - DATA-03 (consumed-vs-dead, D-02/D-03): dropped fields NEVER produce a block.
 *    Explicitly: NO `kind:'audio'` block is EVER emitted (Q1 resolved — audio
 *    is live-only, breaks the intersection, DROPPED per D-09); and no block for
 *    predicted_engagement / emotion_arc / platform_fit / critique / rule_score /
 *    trend_score / gemini_score / ml_score.
 *  - D-14 degradation: heatmap null → `retention-degraded` (never `retention`,
 *    never a synthesized curve); analysis_unavailable/partial_analysis →
 *    `analysis-degraded`; an individual null field → its block omitted silently.
 *
 * Uses the minimal-override factory pattern from the board analog
 * (src/components/board/verdict/__tests__/verdict-derive.test.ts L1-30). Only
 * identical-render.test.ts consumes the REAL fixtures; these synthetic cases
 * exercise the taxonomy + degradation branches directly. Node env (pure module).
 */
import { describe, it, expect } from "vitest";
import type { PredictionResult } from "@/lib/engine/types";
// RED until Wave 2 creates the module:
import {
  toReadingBlocks,
  canonicalFromLive,
  type ReadingBlock,
} from "../view-model";

// Minimal-override live PredictionResult factory (board-analog pattern).
const result = (over: Partial<PredictionResult> = {}): PredictionResult =>
  ({
    overall_score: 77,
    confidence: 0.6,
    confidence_label: "MEDIUM",
    anti_virality_gated: false,
    analysis_unavailable: false,
    partial_analysis: false,
    has_video: true,
    factors: [],
    ...over,
  }) as unknown as PredictionResult;

const kinds = (blocks: ReadingBlock[]): string[] => blocks.map((b) => b.kind);
const blocksFor = (over: Partial<PredictionResult> = {}): ReadingBlock[] =>
  toReadingBlocks(canonicalFromLive(result(over)));

describe("toReadingBlocks — taxonomy (DATA-01)", () => {
  it("emits a verdict block for any populated input", () => {
    expect(kinds(blocksFor())).toContain("verdict");
  });

  it("emits value-bearing block kinds when the source fields are present", () => {
    const blocks = blocksFor({
      hook_decomposition: { weakest_modality: "visual" },
      behavioral_predictions: {
        share_pct: 12,
        completion_pct: 60,
        comment_pct: 8,
        save_pct: 4,
      },
      suggestions: ["tighten the first 2 seconds"],
      persona_behavioral_aggregate: { archetype: "scroll-stopper" },
    } as unknown as Partial<PredictionResult>);
    const k = kinds(blocks);
    expect(k).toEqual(
      expect.arrayContaining(["verdict", "hook", "audience", "fixes"])
    );
  });
});

describe("toReadingBlocks — dropped fields never become blocks (DATA-03)", () => {
  it("NEVER emits a kind:'audio' block (audio is live-only, dropped per D-09)", () => {
    const blocks = blocksFor({
      audio_fingerprint: {
        matched: true,
        sound_name: "trending sound",
      },
    } as unknown as Partial<PredictionResult>);
    expect(kinds(blocks)).not.toContain("audio");
  });

  it("emits no block for any DROP-set field", () => {
    const blocks = blocksFor({
      predicted_engagement: { views: { low: 1, high: 9 } },
      emotion_arc: [{ t: 0, valence: 0.2 }],
      platform_fit: { tiktok: 70 },
      critique: "internal self-check",
      rule_score: 50,
      trend_score: 50,
      gemini_score: 50,
      ml_score: 50,
    } as unknown as Partial<PredictionResult>);
    const k = kinds(blocks);
    for (const forbidden of [
      "predicted-engagement",
      "engagement",
      "emotion-arc",
      "emotion",
      "platform-fit",
      "critique",
      "rule-score",
      "trend-score",
      "gemini-score",
      "ml-score",
      "audio",
    ]) {
      expect(k).not.toContain(forbidden);
    }
  });
});

describe("toReadingBlocks — degradation (D-14)", () => {
  it("heatmap null degrades to retention-degraded, never retention (no synth)", () => {
    const blocks = blocksFor({ heatmap: null } as unknown as Partial<PredictionResult>);
    const k = kinds(blocks);
    expect(k).not.toContain("retention");
    expect(k).toContain("retention-degraded");
  });

  it("emits retention (not degraded) when a real heatmap is present", () => {
    const blocks = blocksFor({
      heatmap: { segments: [], personas: [], weighted_curve: [0.5] },
    } as unknown as Partial<PredictionResult>);
    const k = kinds(blocks);
    expect(k).toContain("retention");
    expect(k).not.toContain("retention-degraded");
  });

  it("whole-analysis degradation emits a first-class analysis-degraded block", () => {
    const unavailable = kinds(blocksFor({ analysis_unavailable: true }));
    expect(unavailable).toContain("analysis-degraded");
    const partial = kinds(blocksFor({ partial_analysis: true }));
    expect(partial).toContain("analysis-degraded");
  });

  it("omits a block silently when its individual source field is null", () => {
    const blocks = blocksFor({
      hook_decomposition: null,
      persona_behavioral_aggregate: null,
    } as unknown as Partial<PredictionResult>);
    const k = kinds(blocks);
    expect(k).not.toContain("hook");
    expect(k).not.toContain("persona-read");
  });
});
