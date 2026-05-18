/**
 * Unit tests for src/lib/engine/wave0/niche-detector.ts — Phase 4 Wave 0.
 * Mirrors deepseek.test.ts mocking pattern (env-vars-before-import).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StageEvent } from "../events";
import type { ContentPayload } from "../types";
import type { CreatorContext } from "../creator";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DEEPSEEK_API_KEY = "test-key";

import { detectNiche } from "../wave0/niche-detector";

// Pick known-good slugs from NICHE_TREE (Plan 04-01 ensured these exist).
// IMPORTANT: OTHER_VALID_PRIMARY sub MUST be a valid sub for that primary — otherwise
// sub-slug validation throws (Pitfall 3 behaviour). The plan's literal test data used
// `sub: "gym"` for fitness, which is NOT in the fitness sub-tree. Substitute with a real
// fitness sub-slug ("strength-training") so Card-1-fallback and AI-source paths can
// exercise the disagreement-with-Card-1 scenario without tripping slug validation.
const VALID_PRIMARY = "beauty";
const VALID_SUB = "skincare";
const OTHER_VALID_PRIMARY = "fitness";
const OTHER_VALID_SUB = "strength-training";

const payload: ContentPayload = {
  input_mode: "video_upload",
  content_text: "GRWM for date night",
  hashtags: ["beauty", "makeup", "grwm"],
  creator_handle: "test_creator",
} as unknown as ContentPayload;

const emptyContext: CreatorContext = {} as CreatorContext;
const card1Context: CreatorContext = {
  niche_primary: VALID_PRIMARY,
  niche_sub: VALID_SUB,
} as CreatorContext;

function deepseekResp(
  p: {
    primary: string; sub: string; micro?: string | null; confidence: number; micro_confidence?: number;
  },
  usage?: Partial<{ prompt_cache_hit_tokens: number; prompt_cache_miss_tokens: number; completion_tokens: number }>,
) {
  return {
    choices: [{ message: { content: JSON.stringify(p) } }],
    usage: {
      prompt_cache_hit_tokens: usage?.prompt_cache_hit_tokens ?? 0,
      prompt_cache_miss_tokens: usage?.prompt_cache_miss_tokens ?? 500,
      completion_tokens: usage?.completion_tokens ?? 80,
    },
  };
}

describe("detectNiche — Phase 4 Wave 0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full Wave0NicheResult on valid DeepSeek response (source=ai)", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, micro: "skincare-routine", confidence: 0.85, micro_confidence: 0.8 }),
    );
    const result = await detectNiche(payload, emptyContext);
    expect(result).toBeDefined();
    expect(result?.primary).toBe(VALID_PRIMARY);
    expect(result?.sub).toBe(VALID_SUB);
    expect(result?.source).toBe("ai");
  });

  it("Card 1 fallback at confidence < 0.6 (D-05)", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: OTHER_VALID_PRIMARY, sub: OTHER_VALID_SUB, confidence: 0.4 }),
    );
    const result = await detectNiche(payload, card1Context);
    expect(result?.source).toBe("card1_fallback");
    expect(result?.primary).toBe(VALID_PRIMARY);
    expect(result?.sub).toBe(VALID_SUB);
    expect(result?.micro).toBeNull();
  });

  it("AI source when confidence ≥ 0.6 (D-05)", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, confidence: 0.75 }),
    );
    const result = await detectNiche(payload, card1Context);
    expect(result?.source).toBe("ai");
  });

  it("drift detection — AI disagrees with Card 1 at confidence ≥ 0.6 (D-06)", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: OTHER_VALID_PRIMARY, sub: OTHER_VALID_SUB, confidence: 0.85 }),
    );
    const result = await detectNiche(payload, card1Context);
    expect(result?.source).toBe("ai");
    expect(result?.primary).toBe(OTHER_VALID_PRIMARY);
    expect(result?.warning).toBe("niche_drift_detected");
  });

  it("no_fallback warning when confidence < 0.6 AND Card 1 empty (D-05)", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, confidence: 0.4 }),
    );
    const result = await detectNiche(payload, emptyContext);
    expect(result?.source).toBe("ai");
    expect(result?.warning).toBe("niche_low_confidence_no_fallback");
  });

  it("micro is null when micro_confidence < 0.6 (D-07)", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, micro: "skincare-routine-morning", confidence: 0.85, micro_confidence: 0.4 }),
    );
    const result = await detectNiche(payload, emptyContext);
    expect(result?.micro).toBeNull();
  });

  it("confidence boundary 0.59 → fallback path", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, confidence: 0.59 }),
    );
    const result = await detectNiche(payload, card1Context);
    expect(result?.source).toBe("card1_fallback");
  });

  it("confidence boundary 0.60 → AI path", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, confidence: 0.60 }),
    );
    const result = await detectNiche(payload, card1Context);
    expect(result?.source).toBe("ai");
  });

  it("drift boundary — 0.60 with disagreement emits drift warning", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: OTHER_VALID_PRIMARY, sub: OTHER_VALID_SUB, confidence: 0.60 }),
    );
    const result = await detectNiche(payload, card1Context);
    expect(result?.warning).toBe("niche_drift_detected");
  });

  it("unknown primary slug → null return + ok:false stage_end (Pitfall 3)", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: "interior-design", sub: "modern", confidence: 0.9 }),
    );
    const cb = vi.fn();
    const result = await detectNiche(payload, emptyContext, cb);
    expect(result).toBeNull();
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { ok?: boolean }).ok).toBe(false);
  });

  it("unknown sub slug for valid primary → null return", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: "invented-sub-slug", confidence: 0.9 }),
    );
    const result = await detectNiche(payload, emptyContext);
    expect(result).toBeNull();
  });

  it("Card 1 fallback skipped when Card 1 has invalid slug (Pitfall 4) → no_fallback warning", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, confidence: 0.4 }),
    );
    const badCard1: CreatorContext = {
      niche_primary: "obsolete-slug-not-in-tree",
      niche_sub: "anything",
    } as CreatorContext;
    const result = await detectNiche(payload, badCard1);
    expect(result?.source).toBe("ai");
    expect(result?.warning).toBe("niche_low_confidence_no_fallback");
  });

  it("emits wave_0_niche_detector stage_start + stage_end with wave=0", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp({ primary: VALID_PRIMARY, sub: VALID_SUB, confidence: 0.85 }),
    );
    const cb = vi.fn();
    await detectNiche(payload, emptyContext, cb);
    const events = cb.mock.calls.map((c) => c[0] as StageEvent);
    const starts = events.filter((e) => e.type === "stage_start" && (e as { stage?: string }).stage === "wave_0_niche_detector");
    const ends = events.filter((e) => e.type === "stage_end" && (e as { stage?: string }).stage === "wave_0_niche_detector");
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect((starts[0] as { wave?: number }).wave).toBe(0);
    expect((ends[0] as { wave?: number }).wave).toBe(0);
  });

  it("cost_cents reflects cache_hit/miss telemetry + < 0.5 defensive cap", async () => {
    mockCreate.mockResolvedValue(
      deepseekResp(
        { primary: VALID_PRIMARY, sub: VALID_SUB, confidence: 0.85 },
        { prompt_cache_hit_tokens: 400, prompt_cache_miss_tokens: 100, completion_tokens: 80 },
      ),
    );
    const cb = vi.fn();
    await detectNiche(payload, emptyContext, cb);
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeGreaterThan(0);
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeLessThan(0.5);
  });
});
