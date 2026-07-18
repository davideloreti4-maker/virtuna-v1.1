/**
 * route.test.ts — POST /api/tools/test/card (TEST-01).
 *
 * The thin adapter that turns a persisted, scored analysis_results row into the honest
 * video-test-card and drops it in the open thread. Locks: auth-first, ownership-scoped row
 * load, the not-ready (409) and not-found (404) gates, the happy path (a schema-valid
 * sim1-max card is persisted with NO 0-100 number), and the honest degrade (no per-persona
 * results → { degraded } with no card written).
 *
 * predictionResultToVideoTestCard runs REAL (it is pure) so the row → card mapping is
 * exercised end to end; only the IO seams (supabase, thread, insert) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Audience } from "@/lib/audience/audience-types";
import type { PersonaSimulationResult } from "@/lib/engine/types";

// ─── Mocks (IO seams only) ──────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => ({})) }));
vi.mock("@/lib/threads/threads", () => ({ createOpenThreadLazy: vi.fn() }));
vi.mock("@/lib/threads/messages", () => ({ insertMessage: vi.fn() }));
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })) }));
vi.mock("@/lib/engine/optimal-post", () => ({ computeOptimalPostWindow: vi.fn(async () => null) }));
vi.mock("@/lib/audience/audience-repo", () => ({
  getAudience: vi.fn(),
  GENERAL_AUDIENCE: { id: "general", name: "General", mode: "general", is_general: true } as unknown as Audience,
}));

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockOpenThread = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsertMessage = insertMessage as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function persona(archetype: PersonaSimulationResult["archetype"], scrolledAt: number): PersonaSimulationResult {
  return {
    persona_id: `p-${archetype}`, archetype, slot_type: "fyp", niche: "fitness",
    scroll_past_second: scrolledAt, watch_through_pct: 50,
    comment_intent: 0, share_intent: 0, save_intent: 0, rewatch_intent: 0, reasoning: "because",
  };
}

/** A scored analysis_results row with 6 stopping personas (→ Strong) + a hero. */
function scoredRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "an-1",
    user_id: "user-1",
    overall_score: 72,
    anti_virality_gated: false,
    deleted_at: null,
    optimal_post_window: null,
    personas: [
      persona("high_engager", 8), persona("saver", 6), persona("lurker", 5),
      persona("purposeful_viewer", 4), persona("niche_deep_buyer", 3), persona("loyalist", 10),
      persona("tough_crowd", 1), persona("sharer", 2), persona("niche_deep_scout", 0),
      persona("cross_niche_curiosity", 0),
    ],
    variants: {
      hero: { verdict_line: "High potential", ceiling: "Sags mid-way.", the_one_fix: "Lead with the after-shot.", go_no_go: "go", post_window: null },
    },
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

  it("200 → persists a schema-valid sim1-max card with NO 0-100 number", async () => {
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.block.type).toBe("video-test-card");
    expect(body.block.props.model).toBe("sim1-max");
    expect(body.block.props.verdict).toBe("High potential");
    expect(body.block.props.band).toBe("Strong"); // 6 personas watched past 3s
    expect(body.block.props.audienceName).toBe("General");
    // The source score 72 must not leak anywhere in the persisted card.
    expect(JSON.stringify(body.block.props)).not.toContain("72");

    // The block was persisted to the open thread.
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks] = mockInsertMessage.mock.calls[0]!;
    expect(threadId).toBe("thread-1");
    expect(role).toBe("assistant");
    expect(blocks[0].type).toBe("video-test-card");
  });

  it("degrades (no card written) when the row has no per-persona results", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase("user-1", scoredRow({ personas: [] })));
    const res = await callPOST({ analysisId: "an-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.degraded).toBe("no_audience_reaction");
    expect(body.analysisId).toBe("an-1");
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });
});
