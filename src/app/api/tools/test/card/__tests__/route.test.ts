/**
 * route.test.ts — POST /api/tools/test/card (TEST-01, craft-teardown rework).
 *
 * The thin adapter that turns a persisted, scored analysis_results row into the in-thread CRAFT
 * card and drops it in the open thread. Locks: auth-first, ownership-scoped row load, the
 * not-ready (409) and not-found (404) gates, the happy path (a schema-valid sim1-max craft card
 * — craftScore from the craft-subset dims — is persisted), and the honest degrade (no craft
 * material → { degraded } with no card written).
 *
 * predictionResultToVideoTestCard runs REAL (it is pure) so the row → card mapping is exercised
 * end to end; the IO seams (supabase, thread, insert, keyframe signing, corpus grounding) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Audience } from "@/lib/audience/audience-types";
import type { ApolloDimension, CounterfactualSuggestionItem, GeminiVideoSignals, HeatmapPayload } from "@/lib/engine/types";

// ─── Mocks (IO seams only) ──────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/threads/threads", () => ({ createOpenThreadLazy: vi.fn() }));
vi.mock("@/lib/threads/messages", () => ({ insertMessage: vi.fn() }));
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })) }));
vi.mock("@/lib/engine/filmstrip/storage", () => ({ signAnalysisFrames: vi.fn(async () => ({})) }));
vi.mock("@/lib/grounding/corpus-tool", () => ({
  executeCorpusSearch: vi.fn(async () => ({ content: "", examples: [], citable: [], record: {} })),
}));
vi.mock("@/lib/grounding/retrieve", () => ({ retrieveCachedExamples: vi.fn() }));
vi.mock("@/lib/audience/audience-repo", () => ({
  getAudience: vi.fn(),
  GENERAL_AUDIENCE: { id: "general", name: "General", mode: "general", is_general: true } as unknown as Audience,
}));
// Ambient v2 Phase C video-seal branch (route §9b): flag ON so the branch is reachable, and
// writeSimSeal mocked so the test can assert the sealed `video` blob shape without a real UPDATE.
// Safe for the other tests — their fixture heatmap carries no `weighted_curve`, so `hasBrainData`
// is false and the branch stays inert regardless of the flag.
vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/threads/sim-seals", () => ({ writeSimSeal: vi.fn(async () => true) }));

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { executeCorpusSearch } from "@/lib/grounding/corpus-tool";
import { writeSimSeal } from "@/lib/threads/sim-seals";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockOpenThread = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsertMessage = insertMessage as ReturnType<typeof vi.fn>;
const mockCorpusSearch = executeCorpusSearch as ReturnType<typeof vi.fn>;
const mockWriteSimSeal = writeSimSeal as ReturnType<typeof vi.fn>;

// ─── Craft fixture (the persisted row's craft slice) ────────────────────────────

const DIMENSIONS: ApolloDimension[] = [
  { name: "hook", band: "strong", score: 87, lever: "Contrast (§2.1)", evidence: "Strong cold open." },
  { name: "retention", band: "mid", score: 55, lever: "Momentum (§2.3)", evidence: "Dips at 0:08." },
  { name: "clarity", band: "strong", score: 72, lever: "One message (§2.4)", evidence: "Legible." },
  { name: "share_pull", band: "mid", score: 64, lever: "Currency (§2.5)", evidence: "Relatable." },
  { name: "substance", band: "strong", score: 70, lever: "Payoff (§2.6)", evidence: "Concrete takeaway." },
  { name: "credibility", band: "strong", score: 80, lever: "Trust (§2.7)", evidence: "Natural delivery." },
];
const SEGMENTS: HeatmapPayload["segments"] = [
  { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
  { idx: 1, t_start: 3, t_end: 6, label: "setup", is_hook_zone: false, keyframe_uri: null },
  { idx: 2, t_start: 6, t_end: 9, label: "stall", is_hook_zone: false, keyframe_uri: null },
  { idx: 3, t_start: 9, t_end: 12, label: "close", is_hook_zone: false, keyframe_uri: null },
];
const FIXES: CounterfactualSuggestionItem[] = [
  { type: "fix", headline: "Recut the open", detail: "Front-load the payoff.", timestamp_ms: 8000, signal_anchor: "retention" },
  { type: "fix", headline: "Add an explicit CTA", detail: "Ask for the follow.", timestamp_ms: 11000, signal_anchor: "cta" },
];

/** A scored analysis_results row carrying the CRAFT slice (variants.apollo + heatmap + counterfactuals). */
function scoredRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "an-1",
    user_id: "user-1",
    overall_score: 72,
    deleted_at: null,
    variants: { apollo: { dimensions: DIMENSIONS, rewrites: [] } },
    heatmap: { segments: SEGMENTS, personas: [] },
    counterfactuals: { suggestions: FIXES },
    verbatim: null,
    ...overrides,
  };
}

/** The four craft dims the Brain signal rows read — a sentinel (identity-asserted through the seal). */
const VIDEO_SIGNALS = {
  hook_visual_impact: 8,
  visual_production_quality: 7,
  pacing_score: 6,
  transition_quality: 5,
} as unknown as GeminiVideoSignals;

/** A row carrying a REAL per-segment attention curve — the gate (`hasBrainData`) for the video seal.
 *  `weighted_hook_score` 0.6 → the first-2s hold → 60% would-stop; `variants.craft.video_signals`
 *  rides into the seal so the reload Brain drill has its craft rows. */
function brainRow(overrides: Record<string, unknown> = {}) {
  return scoredRow({
    variants: { apollo: { dimensions: DIMENSIONS, rewrites: [] }, craft: { video_signals: VIDEO_SIGNALS } },
    heatmap: {
      segments: SEGMENTS,
      personas: [],
      weighted_curve: [0.8, 0.6, 0.3, 0.5],
      weighted_hook_score: 0.6,
      weighted_completion_pct: 0.4,
    },
    ...overrides,
  });
}

/** A brain row that ALSO carries the fold cast — `analysis_results.personas`, in its real shape,
 *  plus the `persona_behavioral_aggregate` that rides with it on every real row (one Wave-3 gate). */
function mockSupabaseWithFold(aggregate: unknown = FOLD_AGGREGATE) {
  const foldPersona = (
    archetype: string,
    slot_type: string,
    scroll_past_second: number,
    intents: [number, number, number, number] = [0, 0, 0, 0],
  ) => ({
    persona_id: `${slot_type}-${archetype}`,
    archetype,
    slot_type,
    niche: "general",
    scroll_past_second,
    watch_through_pct: scroll_past_second === 0 ? 90 : 30,
    share_intent: intents[0],
    save_intent: intents[1],
    comment_intent: intents[2],
    rewatch_intent: intents[3],
    reasoning: `fold-derived: ${archetype}`,
  });
  return makeSupabase(
    "user-1",
    brainRow({
      personas: [
        // tough_crowd + lurker carry nothing; only the cross-niche viewer would act
        foldPersona("tough_crowd", "fyp", 2.8),
        foldPersona("lurker", "fyp", 0),
        foldPersona("cross_niche_curiosity", "cross_niche", 8.5, [15, 10, 5, 0]),
      ],
      persona_behavioral_aggregate: aggregate,
    }),
  );
}

/** The engine's own weighted intent read, shaped as it lands on a real row. */
const FOLD_AGGREGATE = {
  completion_pct: 58,
  share_pct: 35.857142857142854,
  save_pct: 8.285714285714286,
  comment_pct: 30.857142857142858,
  loop_pct: 15.285714285714286,
};

function makeSupabase(userId: string | null, row: unknown, rowErr: unknown = null) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.is = () => builder;
  builder.single = async () => ({ data: row, error: rowErr });
  builder.maybeSingle = async () => ({ data: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: () => builder,
  };
}

async function callPOST(body: unknown): Promise<Response> {
  const { POST } = await import("../route");
  const req = new Request("http://localhost/api/tools/test/card", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(makeSupabase("user-1", scoredRow()));
  mockOpenThread.mockResolvedValue({ id: "thread-1", type: "open", user_id: "user-1", reading_id: null, active_audience_id: null });
  mockInsertMessage.mockResolvedValue(undefined);
  mockCorpusSearch.mockResolvedValue({ content: "", examples: [], citable: [], record: {} });
});

describe("POST /api/tools/test/card", () => {
  it("401 when unauthenticated (auth-first)", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null, null));
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(401);
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });

  it("400 when analysisId is missing", async () => {
    const res = await callPOST({});
    expect(res.status).toBe(400);
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });

  it("404 when the row does not resolve under the session (forged/cross-user id)", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase("user-1", null, { message: "no rows" }));
    const res = await callPOST({ analysisId: "nope" });
    expect(res.status).toBe(404);
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });

  it("409 when the row is still running (overall_score null)", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase("user-1", scoredRow({ overall_score: null })));
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(409);
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });

  it("200 → persists a schema-valid sim1-max craft card (craftScore from the craft dims)", async () => {
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.block.type).toBe("video-test-card");
    expect(body.block.props.model).toBe("sim1-max");
    expect(body.block.props.craftScore).toBe(77); // mean(87,72,70,80)
    expect(body.block.props.audienceName).toBe("General");
    expect(body.block.props.filmstrip).toHaveLength(4);

    // The block was persisted to the open thread, behind the turn's RUN STAMP.
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks] = mockInsertMessage.mock.calls[0]!;
    expect(threadId).toBe("thread-1");
    expect(role).toBe("assistant");
    // run-header is FIRST by contract: <ThreadTurn> reads it to rebuild the intro + stage receipt
    // a reload would otherwise lose, and it holds a ledger slot (never filtered) so the ambient
    // room's positional card ids stay aligned. See lib/tools/run-header.ts.
    expect(blocks[0].type).toBe("run-header");
    expect(blocks[0].props.skill).toBe("test");
    expect(blocks[1].type).toBe("video-test-card");

    // No attention curve on this row (`hasBrainData` false) → NO video seal (never a fabricated one).
    expect(mockWriteSimSeal).not.toHaveBeenCalled();
  });

  it("seals the Ambient v2 VIDEO depth when the row carries a real attention curve (§9b)", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase("user-1", brainRow()));
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(200); // the card still ships — the seal is additive + non-fatal

    // The persisted analysis' REAL Brain read is sealed into the thread, keyed by analysisId, so the
    // Overview→Detail Brain drill survives reload WITHOUT a fresh (billed) fold.
    expect(mockWriteSimSeal).toHaveBeenCalledTimes(1);
    const [, thread, key, seal] = mockWriteSimSeal.mock.calls[0]!;
    expect(thread.id).toBe("thread-1");
    expect(key).toBe("an-1"); // video seals are keyed by analysisId (not the concept text)
    expect(seal.pct).toBe(60); // weighted_hook_score 0.6 → 60% would-stop
    expect(seal.band).toBeNull();
    expect(seal.video).toMatchObject({
      analysisId: "an-1",
      stopPct: 60,
      craftScore: 77, // the card's native viral score (mean of the craft dims), carried onto the seal
      videoSignals: VIDEO_SIGNALS, // the four craft dims ride through for the reload Brain rows
      verbatim: null, // absent on this row → the scrubber falls back to segment labels
    });
    expect(seal.video.heatmap.weighted_curve).toEqual([0.8, 0.6, 0.3, 0.5]); // the REAL curve
    // This row carries NO fold cast (`personas` absent) → no audience depth is invented; the drill
    // stays honestly brain-only.
    expect(seal.population).toBeUndefined();
    expect(seal.video.skimmedPct).toBeUndefined();
    // The card is still persisted (the seal never blocks it).
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
  });

  it("seals the AUDIENCE depth too when the row carries the fold cast (§9b)", async () => {
    // The fold ran against this thread's active audience (analyze R1′b), so these 10 archetype
    // reactors ARE the creator's room — the Population drill's source, from the SAME paid run.
    mockCreateClient.mockResolvedValue(
      mockSupabaseWithFold(),
    );
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(200);

    const [, , , seal] = mockWriteSimSeal.mock.calls[0]!;
    // real headcounts off the real bail seconds, against the row's OWN 3s hook window (SEGMENTS[0])
    expect(seal.population.total).toBe(3);
    expect(seal.population.scroll).toBe(1); // tough_crowd bailed at 2.8s — inside the hook
    expect(seal.population.stop).toBe(2);
    expect(seal.population.segments.map((s: { archetype: string }) => s.archetype)).toContain("tough_crowd");
    // no per-viewer objections exist on a video fold, so none are coded
    expect(seal.population.reasons).toEqual([]);
    // the third band a video can honestly report: cross_niche bailed at 8.5s — after the hook
    expect(seal.video.skimmedPct).toBe(33);
    // …and what they'd DO with it: the engine's weighted verbs, rounded, plus real headcounts
    expect(seal.video.intents).toEqual({
      share: 36, save: 8, comment: 31, rewatch: 15,
      watchThroughPct: 58,
      total: 3, actors: 1, inert: 2,
      // of the two inert reactors only the lurker never scrolled away
      watchedButInert: 1,
    });
  });

  it("seals NO intents when the row carries no behavioral aggregate (degraded Wave 3)", async () => {
    mockCreateClient.mockResolvedValue(mockSupabaseWithFold(null));
    expect((await callPOST({ analysisId: "an-1" })).status).toBe(200);
    const [, , , seal] = mockWriteSimSeal.mock.calls[0]!;
    // the reception panel still seals — only the action profile is absent
    expect(seal.population.total).toBe(3);
    expect(seal.video.intents).toBeUndefined();
  });

  it("skips the video seal when the hold is unreadable (no fabricated %)", async () => {
    // A curve exists (hasBrainData true) but neither hook-score nor completion → no honest %.
    mockCreateClient.mockResolvedValue(
      makeSupabase("user-1", brainRow({
        heatmap: { segments: SEGMENTS, personas: [], weighted_curve: [0.8, 0.6, 0.3, 0.5] },
      })),
    );
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(200);
    expect(mockWriteSimSeal).not.toHaveBeenCalled();
  });

  it("attempts to ground the top fixes (best-effort) without failing the card", async () => {
    await callPOST({ analysisId: "an-1" });
    // Two fixes → grounding runs (capped), and a corpus whiff never blocks persistence.
    expect(mockCorpusSearch).toHaveBeenCalled();
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
  });

  it("degrades (no card written) when the row has no craft material", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase("user-1", scoredRow({ variants: null, heatmap: null, counterfactuals: null })),
    );
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.degraded).toBe("no_craft");
    expect(body.analysisId).toBe("an-1");
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });
});
