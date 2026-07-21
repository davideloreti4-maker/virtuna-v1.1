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
import type { ApolloDimension, CounterfactualSuggestionItem, HeatmapPayload } from "@/lib/engine/types";

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

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { executeCorpusSearch } from "@/lib/grounding/corpus-tool";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockOpenThread = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsertMessage = insertMessage as ReturnType<typeof vi.fn>;
const mockCorpusSearch = executeCorpusSearch as ReturnType<typeof vi.fn>;

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

    // The block was persisted to the open thread.
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks] = mockInsertMessage.mock.calls[0]!;
    expect(threadId).toBe("thread-1");
    expect(role).toBe("assistant");
    expect(blocks[0].type).toBe("video-test-card");
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
