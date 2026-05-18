/**
 * Phase 4 — Wave 0 orchestration tests.
 * Verifies runWave0() in src/lib/engine/wave0.ts:
 *  - Parallel detector invocation via Promise.allSettled
 *  - Isolated failure (one fails, the other's result intact)
 *  - Both-fail / both-success / both-null variants
 *  - creatorContext passthrough to detectNiche
 *  - onEvent callback forwarded to both detectors
 *  - D-22 — Wave 0 introduces NO internal cache (bypassCache freshness contract).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentPayload } from "../types";
import type { CreatorContext } from "../creator";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock both detector modules so we can control resolution + verify forwarded args.
const mockDetectContentType = vi.fn();
const mockDetectNiche = vi.fn();

vi.mock("../wave0/content-type-detector", () => ({
  detectContentType: (...args: unknown[]) => mockDetectContentType(...args),
}));
vi.mock("../wave0/niche-detector", () => ({
  detectNiche: (...args: unknown[]) => mockDetectNiche(...args),
}));

import { runWave0 } from "../wave0";

const payload: ContentPayload = {
  input_mode: "video_upload",
  hashtags: [],
} as unknown as ContentPayload;

const creatorContext: CreatorContext = {} as CreatorContext;

const sampleContentType = { type: "talking_head" as const, confidence: 0.85 };
const sampleNiche = {
  primary: "beauty",
  sub: "skincare",
  micro: null,
  confidence: 0.8,
  source: "ai" as const,
};

describe("runWave0 — Phase 4 orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("both detectors succeed → Wave0Result has both fields non-null", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentType);
    mockDetectNiche.mockResolvedValue(sampleNiche);
    const result = await runWave0(payload, creatorContext);
    expect(result.content_type).toEqual(sampleContentType);
    expect(result.niche).toEqual(sampleNiche);
  });

  it("one detector fails, the other succeeds — Promise.allSettled isolation", async () => {
    mockDetectContentType.mockRejectedValue(new Error("upload failed"));
    mockDetectNiche.mockResolvedValue(sampleNiche);
    const result = await runWave0(payload, creatorContext);
    expect(result.content_type).toBeNull();
    expect(result.niche).toEqual(sampleNiche);
  });

  it("both detectors fail — Wave0Result has both null (stub contract preserved)", async () => {
    mockDetectContentType.mockRejectedValue(new Error("gemini down"));
    mockDetectNiche.mockRejectedValue(new Error("deepseek down"));
    const result = await runWave0(payload, creatorContext);
    expect(result.content_type).toBeNull();
    expect(result.niche).toBeNull();
  });

  it("both detectors return null (no-throw graceful) — Wave0Result has both null", async () => {
    mockDetectContentType.mockResolvedValue(null);
    mockDetectNiche.mockResolvedValue(null);
    const result = await runWave0(payload, creatorContext);
    expect(result.content_type).toBeNull();
    expect(result.niche).toBeNull();
  });

  it("creatorContext is passed through to detectNiche", async () => {
    const ctx: CreatorContext = {
      niche_primary: "fitness",
      niche_sub: "strength-training",
    } as CreatorContext;
    mockDetectContentType.mockResolvedValue(sampleContentType);
    mockDetectNiche.mockResolvedValue(sampleNiche);
    await runWave0(payload, ctx);
    expect(mockDetectNiche).toHaveBeenCalledWith(payload, ctx, undefined);
  });

  it("detectors fire in parallel (both invoked before either resolves)", async () => {
    let contentTypeStarted = false;
    let nicheStarted = false;
    let contentTypeResolved = false;

    mockDetectContentType.mockImplementation(async () => {
      contentTypeStarted = true;
      // Yield to the niche detector before resolving.
      await new Promise((r) => setTimeout(r, 10));
      contentTypeResolved = true;
      return sampleContentType;
    });
    mockDetectNiche.mockImplementation(async () => {
      nicheStarted = true;
      // Assert content_type also already started and not yet resolved — proves parallelism.
      expect(contentTypeStarted).toBe(true);
      expect(contentTypeResolved).toBe(false);
      return sampleNiche;
    });

    await runWave0(payload, creatorContext);
    expect(contentTypeStarted).toBe(true);
    expect(nicheStarted).toBe(true);
  });

  it("onEvent callback is forwarded to both detectors", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentType);
    mockDetectNiche.mockResolvedValue(sampleNiche);
    const cb = vi.fn();
    await runWave0(payload, creatorContext, cb);
    expect(mockDetectContentType).toHaveBeenCalledWith(payload, cb);
    expect(mockDetectNiche).toHaveBeenCalledWith(payload, creatorContext, cb);
  });

  // VALIDATION row line 61 — D-22 ("no internal cache to bypass").
  // CONTEXT D-22: "Wave 0 itself does NOT introduce a stage-level cache (cost is
  // too low to bother, and L1/L2 prediction cache already covers the full result)."
  // Therefore runWave0() has NO bypassCache parameter; bypassCache lives at the
  // route/pipeline level (Phase 3 D-15). The "no caching behavior was introduced"
  // assertion proves the contract: detectors fire fresh on every invocation, no
  // memoization short-circuit, regardless of upstream bypassCache state.
  it("bypassCache: Wave 0 runs fresh under bypassCache (D-22 — no internal cache to bypass)", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentType);
    mockDetectNiche.mockResolvedValue(sampleNiche);

    // Two sequential invocations — same payload + creatorContext. If runWave0
    // had introduced any memoization, the second call would short-circuit and
    // the detectors would be invoked only once total. The contract: BOTH
    // detectors fire on EVERY invocation.
    await runWave0(payload, creatorContext);
    await runWave0(payload, creatorContext);

    expect(mockDetectContentType).toHaveBeenCalledTimes(2);
    expect(mockDetectNiche).toHaveBeenCalledTimes(2);
  });
});
