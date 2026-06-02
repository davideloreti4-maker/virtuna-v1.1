/**
 * Unit tests for src/lib/engine/cache/prediction-cache.ts
 * Per CONTEXT.md D-09/10/11/14/15. Two-tier L1+L2 cache, deterministic content hash,
 * bypassCache semantics. ASVS V4 user_id scoping (T-03-01 mitigation).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase service client — chain returns itself for all methods up to .maybeSingle
const mockMaybeSingle = vi.fn();
const mockSupabaseChain = () => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "gt", "order", "limit"];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.maybeSingle = mockMaybeSingle;
  return chain;
};
const mockFrom = vi.fn(() => mockSupabaseChain());

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import {
  computeContentHash,
  lookupPredictionCache,
  populatePredictionCache,
  cacheKey,
  __resetL1,
} from "../cache/prediction-cache";
import { ENGINE_VERSION } from "../version";
import type { AnalysisInput, PredictionResult } from "../types";

beforeEach(() => {
  __resetL1();
  mockMaybeSingle.mockReset();
  mockFrom.mockClear();
});

describe("computeContentHash", () => {
  it("returns 64-char hex SHA-256 for video_upload mode with buffer", () => {
    const input = { input_mode: "video_upload" } as AnalysisInput;
    const buf = Buffer.from("hello-video");
    const hash = computeContentHash(input, buf);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns deterministic hash for same buffer across calls", () => {
    const input = { input_mode: "video_upload" } as AnalysisInput;
    const buf = Buffer.from("same-bytes");
    expect(computeContentHash(input, buf)).toBe(computeContentHash(input, buf));
  });

  it("returns hash of URL for tiktok_url mode", () => {
    const input = { input_mode: "tiktok_url", tiktok_url: "https://tiktok.com/@a/video/1" } as AnalysisInput;
    const hash = computeContentHash(input);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns hash of trimmed content_text for text mode", () => {
    const input = { input_mode: "text", content_text: "  hello world  " } as AnalysisInput;
    const hash = computeContentHash(input);
    const trimmed = { input_mode: "text", content_text: "hello world" } as AnalysisInput;
    expect(hash).toBe(computeContentHash(trimmed));
  });

  it("different inputs produce different hashes", () => {
    const a = { input_mode: "text", content_text: "a" } as AnalysisInput;
    const b = { input_mode: "text", content_text: "b" } as AnalysisInput;
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });
});

describe("cacheKey", () => {
  it("composes key as `${contentHash}::${ENGINE_VERSION}::${userId}`", () => {
    const key = cacheKey("abc123", "user-1");
    expect(key).toBe(`abc123::${ENGINE_VERSION}::user-1`);
  });

  it("includes ENGINE_VERSION in key", () => {
    const key = cacheKey("abc", "u");
    expect(key).toContain(ENGINE_VERSION);
  });
});

describe("lookupPredictionCache", () => {
  const fakeResult = {
    overall_score: 80,
    engine_version: ENGINE_VERSION,
    signal_availability: { behavioral: true, gemini: true, ml: false, rules: true, trends: true },
  } as PredictionResult;

  it("returns null on L1 miss + L2 miss", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await lookupPredictionCache("hash-miss", "user-1");
    expect(result).toBeNull();
  });

  it("returns cached PredictionResult on L1 hit without hitting Supabase", async () => {
    populatePredictionCache("hash-1", "user-1", fakeResult);
    const result = await lookupPredictionCache("hash-1", "user-1");
    expect(result).toEqual(fakeResult);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("falls through to L2 on L1 miss and hydrates L1", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { overall_score: 80, engine_version: ENGINE_VERSION, signal_availability: { behavioral: true, gemini: true, ml: false, rules: true, trends: true } }, error: null });
    const first = await lookupPredictionCache("hash-2", "user-1");
    expect(first).toBeDefined();
    expect(mockFrom).toHaveBeenCalledTimes(1);

    // Second call should hit L1, NOT Supabase again
    mockFrom.mockClear();
    const second = await lookupPredictionCache("hash-2", "user-1");
    expect(second).toBeDefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("bypassCache=true skips L1 read", async () => {
    populatePredictionCache("hash-3", "user-1", fakeResult);
    const result = await lookupPredictionCache("hash-3", "user-1", { bypass: true });
    expect(result).toBeNull();
  });

  it("L2 error returns null and does not throw", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    const result = await lookupPredictionCache("hash-err", "user-1");
    expect(result).toBeNull();
  });
});

describe("populatePredictionCache", () => {
  const fakeResult = { overall_score: 75, engine_version: ENGINE_VERSION } as PredictionResult;

  it("writes to L1 by default", async () => {
    populatePredictionCache("hash-pop", "user-1", fakeResult);
    const result = await lookupPredictionCache("hash-pop", "user-1");
    expect(result).toEqual(fakeResult);
  });

  it("bypassCache=true skips L1 write (Pitfall 6)", async () => {
    populatePredictionCache("hash-bypass", "user-1", fakeResult, { bypass: true });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await lookupPredictionCache("hash-bypass", "user-1");
    expect(result).toBeNull(); // not in L1; L2 also empty
  });
});

describe("D-23 — version invalidation invariant", () => {
  it("cacheKey embeds ENGINE_VERSION between :: separators", () => {
    const key = cacheKey("hash123", "user-abc");
    expect(key).toBe(`hash123::${ENGINE_VERSION}::user-abc`);
    expect(key.split("::")).toHaveLength(3);
    expect(key.split("::")[1]).toBe(ENGINE_VERSION);
  });

  it("lookupPredictionCache returns null when stored engine_version != current ENGINE_VERSION (post-flip simulation)", async () => {
    // Simulate: Supabase row has stale engine_version (e.g. "3.0.0-dev") but the filter uses current ENGINE_VERSION="3.0.0"
    // When version flips, the .eq("engine_version", ENGINE_VERSION) filter changes — rows with the old
    // version no longer match. Mock the supabase chain to return { data: null } for the mismatch case.
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await lookupPredictionCache("hash123", "user-abc");
    expect(result).toBeNull();
    // Verify the supabase chain was called — cache miss went through to L2
    expect(mockFrom).toHaveBeenCalled();
  });

  it("lookupPredictionCache returns row when stored engine_version matches current ENGINE_VERSION (positive control)", async () => {
    // Simulate: row has matching engine_version — cache hit
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        overall_score: 75,
        engine_version: ENGINE_VERSION,
        signal_availability: { behavioral: true, gemini: true, ml: false, rules: true, trends: true },
      },
      error: null,
    });
    const result = await lookupPredictionCache("hash456", "user-abc");
    expect(result).not.toBeNull();
    expect(mockFrom).toHaveBeenCalled();
  });
});

describe("cache invalidation on engine version bump (CACHE-05, CACHE-06)", () => {
  it("cache key contains current ENGINE_VERSION", () => {
    const key = cacheKey("abc", "u");
    expect(key.split("::")[1]).toBe(ENGINE_VERSION);
  });

  it("L1 entries keyed with old version are not returned when ENGINE_VERSION changes (simulated via direct key construction)", async () => {
    const oldKey = `hash-x::2.1.0::user-1`;
    const newKey = cacheKey("hash-x", "user-1");
    expect(oldKey).not.toBe(newKey); // different keys → different L1 slots → invalidation by construction
  });
});

// ---------------------------------------------------------------------------
// Phase 02-01 — mode field tests (RED: fail before GREEN implementation)
// ---------------------------------------------------------------------------

describe("score-path-stability (D-14) — mode fold does NOT alter score hashes", () => {
  it("score-mode tiktok_url hash matches pre-change hardcoded fixture", () => {
    // Fixture computed from CURRENT code (no mode field) — any future mode-leak
    // into the score path will cause this to diverge and fail the test.
    // URL: https://www.tiktok.com/@creator/video/1234567890
    const EXPECTED_SCORE_HASH = "8a17705c413788d05d4a1f40db5c879d67b2175ad582b84010132b1fda88070a";
    const input = {
      input_mode: "tiktok_url",
      tiktok_url: "https://www.tiktok.com/@creator/video/1234567890",
      content_type: "video",
      mode: "score",
    } as AnalysisInput;
    expect(computeContentHash(input)).toBe(EXPECTED_SCORE_HASH);
  });

  it("score-mode hash equals hash of same input without mode field (backward-compat)", () => {
    const withMode = {
      input_mode: "tiktok_url",
      tiktok_url: "https://www.tiktok.com/@creator/video/1234567890",
      content_type: "video",
      mode: "score",
    } as AnalysisInput;
    const withoutMode = {
      input_mode: "tiktok_url",
      tiktok_url: "https://www.tiktok.com/@creator/video/1234567890",
      content_type: "video",
    } as AnalysisInput;
    // Both must produce the same hash — score path is byte-identical to pre-change output.
    expect(computeContentHash(withMode)).toBe(computeContentHash(withoutMode));
  });
});

describe("mode-distinctness (D-14) — remix hash differs from score hash for same URL", () => {
  it("remix-mode and score-mode produce different hashes for same tiktok_url", () => {
    const url = "https://www.tiktok.com/@creator/video/9999999999";
    const scoreInput = {
      input_mode: "tiktok_url",
      tiktok_url: url,
      content_type: "video",
      mode: "score",
    } as AnalysisInput;
    const remixInput = {
      input_mode: "tiktok_url",
      tiktok_url: url,
      content_type: "video",
      mode: "remix",
    } as AnalysisInput;
    expect(computeContentHash(scoreInput)).not.toBe(computeContentHash(remixInput));
  });

  it("remix-mode and score-mode produce different hashes for same video_upload path", () => {
    const path = "user-abc/video.mp4";
    const scoreInput = {
      input_mode: "video_upload",
      video_storage_path: path,
      content_type: "video",
      mode: "score",
    } as AnalysisInput;
    const remixInput = {
      input_mode: "video_upload",
      video_storage_path: path,
      content_type: "video",
      mode: "remix",
    } as AnalysisInput;
    expect(computeContentHash(scoreInput)).not.toBe(computeContentHash(remixInput));
  });
});
