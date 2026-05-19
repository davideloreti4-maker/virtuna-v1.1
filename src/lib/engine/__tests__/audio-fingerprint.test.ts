/**
 * Unit tests for src/lib/engine/audio-fingerprint.ts — Phase 6 Wave 3 (Plan 06-04).
 *
 * WARNING 6 fix: explicit Sentry-vs-warn asymmetry:
 *   - SOFT failures (no queryEmbedding, RPC returned an error object, no match above threshold):
 *     log.warn / log.debug ONLY; Sentry.captureException MUST NOT be called.
 *   - HARD failures (thrown exception caught by outer try/catch): Sentry.captureException IS called
 *     with `{ tags: { stage: "audio_fingerprint" } }`.
 *
 * Mocking pattern mirrors wave0-content-type.test.ts (the WARNING 6 source-of-truth).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AudioFingerprintResult } from "../types";

// vi.hoisted() runs BEFORE the vi.mock factories are evaluated. We pre-create the spies here so
// the factories below can reference them safely (without the "Cannot access before initialization"
// hoisting error).
const { mockSentryCaptureException, mockEmbedContent, mockRpc } = vi.hoisted(() => ({
  mockSentryCaptureException: vi.fn(),
  mockEmbedContent: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Sentry mock — assertions distinguish "Sentry called" (hard failure) vs "Sentry NOT called" (soft).
vi.mock("@sentry/nextjs", () => ({
  captureException: mockSentryCaptureException,
  addBreadcrumb: vi.fn(),
}));

vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { embedContent: mockEmbedContent };
  });
  return { GoogleGenAI: MockGoogleGenAI };
});

const mockSupabaseClient = {
  rpc: mockRpc,
} as unknown as import("@supabase/supabase-js").SupabaseClient;

// Env vars BEFORE the dynamic import — ensures GEMINI_API_KEY + threshold are read at module load.
process.env.GEMINI_API_KEY = "test-key";
delete process.env.AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD;
delete process.env.GEMINI_EMBEDDING_MODEL;

import { matchAudioFingerprint } from "../audio-fingerprint";

function make768Vec(): number[] {
  return Array.from({ length: 768 }, (_, i) => 0.01 * (i + 1));
}

describe("matchAudioFingerprint — Phase 6 Wave 3 (Plan 06-04)", () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
    mockRpc.mockReset();
    mockSentryCaptureException.mockReset();
  });

  it("Test 1: happy path — returns AudioFingerprintResult on Gemini + RPC success above threshold", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "abc",
          sound_name: "Hip Hop Beat",
          sound_url: "https://cdn.example/song.mp3",
          trend_phase: "rising",
          velocity_score: 42,
          similarity: 0.87,
        },
      ],
      error: null,
    });

    const result = await matchAudioFingerprint(
      "upbeat hip-hop track, 90 BPM, sampled vocal hook",
      mockSupabaseClient,
    );

    expect(result).toEqual<AudioFingerprintResult>({
      sound_name: "Hip Hop Beat",
      sound_url: "https://cdn.example/song.mp3",
      similarity: 0.87,
      trend_phase: "rising",
      velocity_score: 42,
    });
    expect(mockRpc).toHaveBeenCalledWith("match_trending_sound_by_audio", {
      query_embedding: expect.any(Array),
      match_threshold: 0.8,
      match_count: 1,
    });
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it("Test 2: null audio_description short-circuits (no Gemini call, NO Sentry)", async () => {
    const result = await matchAudioFingerprint(null, mockSupabaseClient);
    expect(result).toBeNull();
    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it("Test 3: empty-string audio_description short-circuits (no Gemini call, NO Sentry)", async () => {
    const result = await matchAudioFingerprint("   ", mockSupabaseClient);
    expect(result).toBeNull();
    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it("Test 4: HARD failure — Gemini embedContent throws → Sentry IS called", async () => {
    mockEmbedContent.mockRejectedValueOnce(new Error("Quota exceeded"));

    const result = await matchAudioFingerprint("upbeat hip-hop", mockSupabaseClient);

    expect(result).toBeNull();
    expect(mockSentryCaptureException).toHaveBeenCalledTimes(1);
    expect(mockSentryCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ stage: "audio_fingerprint" }),
      }),
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("Test 5: SOFT failure — embedContent returns no embeddings → Sentry NOT called", async () => {
    mockEmbedContent.mockResolvedValueOnce({ embeddings: undefined });

    const result = await matchAudioFingerprint("upbeat hip-hop", mockSupabaseClient);

    expect(result).toBeNull();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("Test 6: SOFT failure — Supabase RPC returns error object → Sentry NOT called", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "RPC failed", code: "PGRST116" },
    });

    const result = await matchAudioFingerprint("upbeat hip-hop", mockSupabaseClient);

    expect(result).toBeNull();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it("Test 7: SOFT outcome — RPC returns empty array (no match above threshold) → Sentry NOT called", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await matchAudioFingerprint("obscure ambient track", mockSupabaseClient);

    expect(result).toBeNull();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it("Test 8: threshold boundary 0.79 — empty matches (RPC enforces threshold) returns null", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });
    // RPC enforces match_threshold internally — when no row meets it, returns []
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await matchAudioFingerprint("test desc", mockSupabaseClient);

    expect(result).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("match_trending_sound_by_audio", {
      query_embedding: expect.any(Array),
      match_threshold: 0.8,
      match_count: 1,
    });
  });

  it("Test 9: threshold boundary 0.80 — RPC returns a row at exactly 0.80 → result includes it", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "boundary",
          sound_name: "Boundary Sound",
          sound_url: null,
          trend_phase: "peak",
          velocity_score: 30,
          similarity: 0.8,
        },
      ],
      error: null,
    });

    const result = await matchAudioFingerprint("test desc", mockSupabaseClient);

    expect(result).not.toBeNull();
    expect(result?.similarity).toBe(0.8);
    expect(result?.sound_name).toBe("Boundary Sound");
  });

  it("Test 10: custom threshold via env (AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD=0.85)", async () => {
    vi.resetModules();
    process.env.AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD = "0.85";

    // Re-import after env mutation so the new module instance picks up the override.
    const localRpc = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const localSupabase = {
      rpc: localRpc,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });

    const mod = await import("../audio-fingerprint");
    await mod.matchAudioFingerprint("desc with custom threshold", localSupabase);

    expect(localRpc).toHaveBeenCalledWith("match_trending_sound_by_audio", {
      query_embedding: expect.any(Array),
      match_threshold: 0.85,
      match_count: 1,
    });

    delete process.env.AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD;
    vi.resetModules();
  });

  it("Test 11: trend_phase pass-through (AUDIO-06) — all 4 valid values + null", async () => {
    const phases: Array<AudioFingerprintResult["trend_phase"]> = [
      "emerging",
      "rising",
      "peak",
      "declining",
      null,
    ];

    for (const phase of phases) {
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: make768Vec() }],
      });
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: `id-${phase ?? "null"}`,
            sound_name: `Sound ${phase ?? "null"}`,
            sound_url: null,
            trend_phase: phase,
            velocity_score: 10,
            similarity: 0.9,
          },
        ],
        error: null,
      });

      const result = await matchAudioFingerprint("test", mockSupabaseClient);
      expect(result?.trend_phase).toBe(phase);
    }
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
  });

  it("Test 12: returns FIRST row when RPC returns multiple — pins matches[0] behavior", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "first",
          sound_name: "First Match",
          sound_url: "https://first",
          trend_phase: "rising",
          velocity_score: 50,
          similarity: 0.95,
        },
        {
          id: "second",
          sound_name: "Second Match",
          sound_url: "https://second",
          trend_phase: "peak",
          velocity_score: 20,
          similarity: 0.85,
        },
      ],
      error: null,
    });

    const result = await matchAudioFingerprint("test", mockSupabaseClient);
    expect(result?.sound_name).toBe("First Match");
    expect(result?.similarity).toBe(0.95);
  });

  it("Test 13: velocity_score coerces from string (Supabase numeric column)", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: make768Vec() }],
    });
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "coerce",
          sound_name: "Numeric String",
          sound_url: null,
          trend_phase: "rising",
          velocity_score: "42.5", // Supabase deserializes numeric as string by default
          similarity: 0.9,
        },
      ],
      error: null,
    });

    const result = await matchAudioFingerprint("test", mockSupabaseClient);
    expect(result?.velocity_score).toBe(42.5);
    expect(typeof result?.velocity_score).toBe("number");
  });
});
