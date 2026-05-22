/**
 * Phase 4 — Wave 0 orchestration tests.
 * Verifies runWave0() in src/lib/engine/wave0.ts:
 *  - Single detector invocation (D-17 fold: no separate detectNiche)
 *  - Failure (null result from detectContentType) → both content_type and niche null
 *  - both-success variant
 *  - videoContext passthrough to detectContentType (D-18)
 *  - onEvent callback forwarded to detectContentType
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

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// D-17: Only mock detectContentType — detectNiche no longer exists.
const mockDetectContentType = vi.fn();

vi.mock("../wave0/content-type-detector", () => ({
  detectContentType: (...args: unknown[]) => mockDetectContentType(...args),
}));

import { runWave0 } from "../wave0";

// Mock supabase client
const mockSupabaseClient = {
  storage: {
    from: vi.fn(() => ({
      download: vi.fn().mockResolvedValue({
        data: new Blob([new Uint8Array(8)]),
        error: null,
      }),
    })),
  },
} as unknown as import("@supabase/supabase-js").SupabaseClient;

const payload: ContentPayload = {
  input_mode: "video_upload",
  hashtags: [],
} as unknown as ContentPayload;

const creatorContext: CreatorContext = {} as CreatorContext;

// D-17: Extended content-type result includes niche fields
const sampleContentTypeExtended = {
  type: "talking_head" as const,
  confidence: 0.85,
  niche_primary_slug: "beauty",
  niche_micro_slug: null,
  niche_confidence: 0.9,
};

describe("runWave0 — Phase 4 orchestration (D-17 niche fold)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("D-17-T1: detectContentType returns extended result → Wave0Result has both content_type and niche non-null", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentTypeExtended);
    const result = await runWave0(payload, mockSupabaseClient, creatorContext);
    expect(result.content_type).toEqual({ type: "talking_head", confidence: 0.85 });
    expect(result.niche).toEqual({
      primary_slug: "beauty",
      micro_slug: null,
      confidence: 0.9,
    });
  });

  it("D-17-T2: runWave0 returns both content_type and niche from single detectContentType call (no detectNiche)", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentTypeExtended);
    const result = await runWave0(payload, mockSupabaseClient, creatorContext);
    // Only one detector call should happen
    expect(mockDetectContentType).toHaveBeenCalledTimes(1);
    // Both fields populated from single call
    expect(result.content_type).not.toBeNull();
    expect(result.niche).not.toBeNull();
  });

  it("D-17-T3: niche_primary_slug value from extended result maps to niche.primary_slug in Wave0Result", async () => {
    mockDetectContentType.mockResolvedValue({
      ...sampleContentTypeExtended,
      niche_primary_slug: "fitness",
      niche_confidence: 0.75,
    });
    const result = await runWave0(payload, mockSupabaseClient, creatorContext);
    expect(result.niche?.primary_slug).toBe("fitness");
    expect(result.niche?.confidence).toBe(0.75);
  });

  it("D-17-T4: when detectContentType returns null (Gemini failure) → both content_type and niche are null", async () => {
    mockDetectContentType.mockResolvedValue(null);
    const result = await runWave0(payload, mockSupabaseClient, creatorContext);
    expect(result.content_type).toBeNull();
    expect(result.niche).toBeNull();
  });

  it("D-17-T5: when detectContentType rejects (unexpected throw) → both content_type and niche null (captured to Sentry)", async () => {
    mockDetectContentType.mockRejectedValue(new Error("gemini down"));
    const result = await runWave0(payload, mockSupabaseClient, creatorContext);
    expect(result.content_type).toBeNull();
    expect(result.niche).toBeNull();
  });

  it("D-17-T6: No detectNiche import — only detectContentType is invoked", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentTypeExtended);
    await runWave0(payload, mockSupabaseClient, creatorContext);
    // Verify no second mock was called (detectNiche is deleted)
    expect(mockDetectContentType).toHaveBeenCalledTimes(1);
  });

  it("D-17-T7: niche is null when niche_primary_slug is missing from extended result", async () => {
    mockDetectContentType.mockResolvedValue({
      type: "talking_head",
      confidence: 0.85,
      // No niche_primary_slug — simulates missing niche from Gemini
    });
    const result = await runWave0(payload, mockSupabaseClient, creatorContext);
    // content_type is populated
    expect(result.content_type).toEqual({ type: "talking_head", confidence: 0.85, warning: undefined });
    // niche is null because no niche_primary_slug
    expect(result.niche).toBeNull();
  });

  it("D-18: videoContext passed through to detectContentType", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentTypeExtended);
    const vc = { fileUri: "gs://pre-uploaded", mimeType: "video/mp4" };
    await runWave0(payload, mockSupabaseClient, creatorContext, vc);
    expect(mockDetectContentType).toHaveBeenCalledWith(payload, mockSupabaseClient, vc, undefined);
  });

  it("onEvent callback is forwarded to detectContentType", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentTypeExtended);
    const cb = vi.fn();
    await runWave0(payload, mockSupabaseClient, creatorContext, undefined, cb);
    expect(mockDetectContentType).toHaveBeenCalledWith(payload, mockSupabaseClient, undefined, cb);
  });

  it("both detectContentType returns null (graceful) — Wave0Result has both null", async () => {
    mockDetectContentType.mockResolvedValue(null);
    const result = await runWave0(payload, mockSupabaseClient, creatorContext);
    expect(result.content_type).toBeNull();
    expect(result.niche).toBeNull();
  });

  it("bypassCache: Wave 0 runs fresh under bypassCache (D-22 — no internal cache to bypass)", async () => {
    mockDetectContentType.mockResolvedValue(sampleContentTypeExtended);

    await runWave0(payload, mockSupabaseClient, creatorContext);
    await runWave0(payload, mockSupabaseClient, creatorContext);

    // Single detector fires on every invocation — no memoization
    expect(mockDetectContentType).toHaveBeenCalledTimes(2);
  });
});
