/**
 * Phase 01 Plan 04 — [BLOCKING] pack-seam smoke + structural gate (PACK-01..04).
 *
 * The phase's load-bearing safety check. The phase CANNOT pass with this red.
 *
 * Read through the D-04 lens: PACK-04 / ROADMAP SC#4 "byte-identical" is
 * SUPERSEDED by D-02/D-03. There is NO golden-master / byte-equality rig here.
 * This is cheap insurance that the in-place pack-seam cut (D-01) did NOT break
 * Socials — that `pack.scoring.run` still COMPLETES and returns a STRUCTURALLY
 * valid PredictionResult (required keys present, `overall_score` finite ∈
 * [0,100], `engine_version === "3.21.0"`) — NOT exact values. Combined with git,
 * this smoke (not a parallel code path) is the D-01 rollback safety net.
 *
 * Four protected invariants:
 *  PACK-02/03: `resolvePack("socials")` returns a fully-populated DomainPack —
 *    all 7 spec fields + `id`/`run`/`scoring` present.
 *  PACK-04 (D-03/D-04 lens): `pack.scoring.run(<fixture>)` completes for BOTH a
 *    text and a video fixture and returns a structurally valid, sane-band result.
 *  T-01-CP: `engine_version === "3.21.0"` on the result AND `ENGINE_VERSION ===
 *    "3.21.0"` — catches an accidental version bump (Pitfall 2).
 *  PACK-01: the core dispatch surface (`packs/index.ts`) holds ZERO scoring
 *    logic (static no-`aggregateScores` check, comments stripped first).
 *
 * Offline + deterministic (RESEARCH Assumption A3): the LLM/IO layer is mocked
 * the way aggregator.test.ts / pipeline.test.ts do — `deepseek.isCircuitOpen`
 * returns true to short-circuit the Stage-11 network call; logger/supabase/
 * sentry/cache are stubbed so the structural run touches no real IO. The gate is
 * structural, NOT a live end-to-end run.
 */
import { describe, it, expect, vi } from "vitest";

// =====================================================
// Mocks — transitive IO/env dependencies of the scoring graph
// (mirrors aggregator.test.ts so the structural run stays offline/deterministic)
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// =====================================================
// Mocks — LLM-touching scorer dependencies (offline determinism, A3)
// =====================================================

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
  // isCircuitOpen=true short-circuits Stage 11 (the only network call inside the
  // aggregator). Stage 10 is deterministic TS and runs regardless.
  isCircuitOpen: vi.fn(() => true),
}));

vi.mock("../flop-warning", () => ({
  maybeAppendLikelyFlopWarning: vi.fn(),
}));

// =====================================================
// Imports (after mocks) — the SEAM under test, reached only via the pack
// =====================================================

import { resolvePack, SOCIALS_PACK } from "../packs";
import type { DomainPack } from "../packs";
import { makePipelineResult, makeContentPayload } from "./factories";
import { ENGINE_VERSION } from "../version";
import type { PredictionResult } from "../types";

// The 8 top-level PredictionResult keys the D-03 smoke asserts present (keys,
// NOT values — D-04). Mirrors SOCIALS_PACK.outputSchema.requiredKeys.
const REQUIRED_KEYS = [
  "overall_score",
  "confidence",
  "confidence_label",
  "behavioral_predictions",
  "factors",
  "signal_availability",
  "engine_version",
  "input_mode",
] as const;

/** Structural (NOT byte-identical) validity assertions — D-03/D-04. */
function expectStructurallyValid(result: PredictionResult): void {
  // All required keys present (assert KEYS, not values).
  expect(Object.keys(result)).toEqual(expect.arrayContaining([...REQUIRED_KEYS]));
  // overall_score is a finite number in the sane band [0, 100].
  expect(typeof result.overall_score).toBe("number");
  expect(Number.isFinite(result.overall_score)).toBe(true);
  expect(result.overall_score).toBeGreaterThanOrEqual(0);
  expect(result.overall_score).toBeLessThanOrEqual(100);
  // ENGINE_VERSION did not drift (T-01-CP / Pitfall 2).
  expect(result.engine_version).toBe("3.21.0");
}

describe("pack-seam smoke + structural gate (PACK-04, D-03/D-04) — BLOCKING", () => {
  it("resolvePack(\"socials\") returns a fully-populated DomainPack (PACK-02/03)", () => {
    const pack: DomainPack = resolvePack("socials");
    expect(pack).toBe(SOCIALS_PACK);
    expect(pack.id).toBe("socials");

    // All 7 DomainPack spec fields present...
    expect(pack.populations).toBeDefined();
    expect(pack.grounding).toBeDefined();
    expect(pack.stimulusTypes).toBeDefined();
    expect(pack.reactionFrame).toBeDefined();
    expect(pack.scoring).toBeDefined();
    expect(pack.outputSchema).toBeDefined();
    expect(pack.calibration).toBeDefined();

    // ...plus the orchestration + scoring entrypoints.
    expect(typeof pack.run).toBe("function");
    expect(typeof pack.scoring.run).toBe("function");
  });

  it("pack.scoring.run completes for a TEXT fixture → structurally valid PredictionResult", async () => {
    const pack = resolvePack("socials");
    // Default factory is text mode (input_mode "text", no video, foldOutcome null).
    const result = await pack.scoring.run(makePipelineResult());
    expectStructurallyValid(result);
    expect(result.input_mode).toBe("text");
  });

  it("pack.scoring.run completes for a VIDEO fixture → structurally valid PredictionResult", async () => {
    const pack = resolvePack("socials");
    // Video variant via overrides ONLY (no hand-rolled mock — RESEARCH §Don't Hand-Roll):
    // flip the stimulus axis to a video_upload payload.
    const result = await pack.scoring.run(
      makePipelineResult({
        payload: makeContentPayload({
          input_mode: "video_upload",
          content_type: "video",
        }),
      }),
    );
    expectStructurallyValid(result);
    expect(result.input_mode).toBe("video_upload");
  });

  it("ENGINE_VERSION is exactly '3.21.0' (T-01-CP — no accidental bump)", () => {
    expect(ENGINE_VERSION).toBe("3.21.0");
  });

  it("the dispatch surface (packs/index.ts) holds ZERO scoring logic (PACK-01, static)", async () => {
    // Belt-and-suspenders structural proof: the core dispatch surface must reach
    // scoring ONLY via pack.scoring.run — it must not name the scorer itself.
    // Strip comments FIRST so the PACK-01 contract PROSE in the header (which
    // legitimately references the concept) does not trip the matcher — we test
    // real code, not docs (mirrors explore-runner.test.ts:300-319).
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/engine/packs/index.ts"),
      "utf8",
    );
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "") // strip block comments
      .replace(/\/\/.*$/gm, ""); // strip line comments

    expect(code).not.toMatch(/aggregateScores/);
  });
});
