/**
 * route.test.ts — POST /api/tools/react integration tests (Plan 13-01, Task 2).
 *
 * The thin type-to-room reaction route: fires ONE Flash text-mode reaction for an ad-hoc
 * thought and returns the real { fraction, scrollQuote } the client turns into a spotlight
 * + Lens (D-04). It MUST reuse the shipped Flash reaction primitive (NOT the markdown chat
 * route — Pitfall 1) and the shared buildReactionPanel niche-resolution path (NOT a generic
 * panel — Pitfall 2), or it returns prose / niche-blind Mixed and the moat reads as fake.
 *
 * Tests:
 *   - 401 when unauthenticated (CR-01 auth-first)
 *   - 400 on empty / whitespace-only text (Zod boundary), no Flash call fired
 *   - happy path → { fraction, scrollQuote } from aggregateFlash + lead stop-verdict quote
 *   - runFlashTextMode called with the resolved panel + audienceRepaint (niche discrimination wired)
 *   - audience resolved server-side from the open thread (never from the body)
 *   - 502 { error: "reaction_failed" } when the Flash primitive throws
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
}));

vi.mock("@/lib/audience/audience-repo", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audience/audience-repo")>(
    "@/lib/audience/audience-repo",
  );
  return {
    ...actual,
    getAudience: vi.fn(),
  };
});

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
}));

// The FLYWHEEL pin (opt-in, Ambient v2 Phase D) — mocked so no DB write runs; tests assert the
// route fires it ONLY when pin:true and with the right audience_id (null for a virtual audience).
vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// The content-characterization LLM call is mocked; reactPopulation runs REAL (pure math) so the
// tests exercise the actual Stage 2 aggregate, not a stubbed shape.
vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: vi.fn(),
}));

// buildReactionPanel is real (we want to assert the route wires the resolved panel through).
// resolveNicheKey + the helper run unmocked so a real niche resolves to a non-null panel.niche.

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10 personas: `stops` stop, rest scroll. First stop persona's quote is the lead. */
function makePersonas(stops: number) {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < stops ? "stop" : "scroll",
    quote: `Quote from persona ${i}`,
  }));
}

/** A minimal calibrated audience whose signature carries v2 axes (drives the population path). */
function makeAudienceWithAxes() {
  const reaction = (interests: Record<string, number>, attentionSpan: number) => ({
    interests,
    hookSensitivity: 0.3,
    noveltyBias: 0.5,
    skepticism: 0.2,
    attentionSpan,
  });
  const behavior = { watchThrough: 0.5, sharePropensity: 0.3, commentPropensity: 0.3, savePropensity: 0.3 };
  return {
    id: "aud-calibrated",
    is_general: false,
    personas: [{ archetype: "lurker", repaint: "Scrollers" }],
    signature: {
      creator_persona: { content_description: "x", context: "x", writing_style_sample: "x", format_signature: "x" },
      audience: {
        follower_tier: "10k-100k",
        maturity: "established",
        temperature_mix: { cold: 0.5, warm: 0.3, hot: 0.2 },
        interest_tags: ["magic"],
        what_resonates: "x",
        what_falls_flat: "x",
        persona_weights: { fyp: 0.4, niche: 0.3, loyalist: 0.2, cross_niche: 0.1 },
        topic_vocab: ["spectacle", "craft"],
        personas: [
          { archetype: "lurker", share: 0.6, temperature: "cold", disposition: "scanner", reaction_frame: "x", evidence: "x", display_name: "Scrollers", reaction: reaction({}, 0.1), behavior },
          { archetype: "niche_deep_buyer", share: 0.4, temperature: "hot", disposition: "collector", reaction_frame: "x", evidence: "x", display_name: "Craft nerds", reaction: reaction({ craft: 0.9 }, 0.9), behavior },
        ],
      },
      summary: "x",
      provenance: { handle: "@x", scraped_at: "2026-07-16", videos_analyzed: 8, videos_watched: 4, sub_coverage: "6/8" },
    },
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/tools/react", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** A createClient mock with auth + a creator_profiles select chain (niche_primary: fitness). */
function mockAuthedClient(userId = "user-123") {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { niche_primary: "fitness" }, error: null }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/react", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "what if I open with a question?" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 on empty text and fires NO Flash call", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "" }));
    expect(res.status).toBe(400);
    expect(runFlashTextMode).not.toHaveBeenCalled();
  });

  it("returns 400 on whitespace-only text and fires NO Flash call", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "   \n\t  " }));
    expect(res.status).toBe(400);
    expect(runFlashTextMode).not.toHaveBeenCalled();
  });

  it("happy path → { fraction, scrollQuote } from aggregateFlash + lead stop quote", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: null, // General default → no audience query
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(6) }, // 6 stop → "6/10 stop"
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "what if I open with a question?" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fraction).toBe("6/10 stop");
    expect(json.scrollQuote).toBe("Quote from persona 0"); // first stop-verdict persona
    // General/no-signature audience → no v2 axes → population is null (the guard holds).
    expect(json.population).toBeNull();
  });

  it("computes the population projection when the resolved signature has v2 axes", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { getAudience } = await import("@/lib/audience/audience-repo");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { characterizeContent } = await import("@/lib/audience/characterize-content");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: "aud-calibrated",
    });
    (getAudience as ReturnType<typeof vi.fn>).mockResolvedValue(makeAudienceWithAxes());
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(6) },
      warnings: [],
    });
    // A strong spectacle hook → the pure scorer stops some individuals.
    (characterizeContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      topics: { spectacle: 0.9 },
      hookStrength: 0.95,
      novelty: 0.5,
      hype: 0.1,
      slowness: 0.1,
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "I zipped open my wall like a tent." }));

    expect(res.status).toBe(200);
    const json = await res.json();
    // characterize was called with the signature's topic_vocab (the axis space).
    expect(characterizeContent).toHaveBeenCalledTimes(1);
    expect((characterizeContent as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toEqual([
      "spectacle",
      "craft",
    ]);
    // A REAL aggregate came back — a genuine distribution, not the 10's rollup.
    expect(json.population).toBeTruthy();
    expect(json.population.total).toBeGreaterThan(0);
    expect(json.population.stop + json.population.scroll).toBe(json.population.total);
    expect(json.population.segments.length).toBe(2);
    // The reaction ({fraction} from the 10) is UNCHANGED — population rides alongside it.
    expect(json.fraction).toBe("6/10 stop");
  });

  it("degrades gracefully — characterize throws → population null, reaction still 200", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { getAudience } = await import("@/lib/audience/audience-repo");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { characterizeContent } = await import("@/lib/audience/characterize-content");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: "aud-calibrated",
    });
    (getAudience as ReturnType<typeof vi.fn>).mockResolvedValue(makeAudienceWithAxes());
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(4) },
      warnings: [],
    });
    (characterizeContent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("qwen down"));

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "a thought" }));

    expect(res.status).toBe(200); // the projection failing NEVER breaks the reaction
    const json = await res.json();
    expect(json.population).toBeNull();
    expect(json.fraction).toBe("4/10 stop");
  });

  it("calls runFlashTextMode with the resolved panel (niche discrimination wired, Pitfall 2)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: null,
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(5) },
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    await POST(makeRequest({ text: "5 myths about protein, busted" }));

    expect(runFlashTextMode).toHaveBeenCalledTimes(1);
    const call = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [text, framing, panel] = call;
    expect(text).toBe("5 myths about protein, busted");
    expect(framing).toBe("hook"); // default framing (RESEARCH A1)
    // The panel is the buildReactionPanel output — a real niche (fitness) resolves non-null.
    expect(panel).toBeTruthy();
    expect(panel.niche).not.toBeNull();
    expect(panel.contentType).toBeNull();
  });

  it("resolves the audience server-side from the open thread (never the body)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { getAudience } = await import("@/lib/audience/audience-repo");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: "aud-server-side",
    });
    (getAudience as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "aud-server-side",
      is_general: false,
      personas: [
        { archetype: "tough_crowd", repaint: "Skeptical regular" },
      ],
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(7) },
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    // Body carries a DIFFERENT audience id — it MUST be ignored (server resolves from the thread).
    await POST(makeRequest({ text: "test thought", audienceId: "aud-from-body-attack" }));

    // getAudience was called with the THREAD's active_audience_id, not the body value.
    expect(getAudience).toHaveBeenCalledTimes(1);
    expect((getAudience as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toBe("aud-server-side");

    // The resolved audience's repaint reached the Flash call (4th arg).
    const call = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const audienceRepaint = call[3];
    expect(audienceRepaint).toEqual({ tough_crowd: "Skeptical regular" });
  });

  it("pin:true captures the flywheel vector with the persisted audience_id (Phase D relocation)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { getAudience } = await import("@/lib/audience/audience-repo");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

    const client = mockAuthedClient();
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: "aud-real",
    });
    // A persisted audience (real user_id, no v2 axes → no population path) → pins its own id.
    (getAudience as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "aud-real",
      user_id: "creator-1",
      is_general: false,
      personas: [{ archetype: "tough_crowd", repaint: "Skeptical regular" }],
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(7) },
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "a deliberate sim", pin: true }));

    expect(res.status).toBe(200);
    expect(pinPredictedSignature).toHaveBeenCalledTimes(1);
    const [, personas, ctx] = (pinPredictedSignature as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(personas).toHaveLength(10); // the fired sim's personas, passed straight through
    expect(ctx).toEqual({ audienceId: "aud-real" });
  });

  it("pin:true on the General default pins a NULL audience_id (virtual constant, no DB row)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: null, // General default → the virtual GENERAL_AUDIENCE (user_id __virtual__)
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(5) },
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "a general sim", pin: true }));

    expect(res.status).toBe(200);
    expect(pinPredictedSignature).toHaveBeenCalledTimes(1);
    const [, , ctx] = (pinPredictedSignature as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(ctx).toEqual({ audienceId: null });
  });

  it("omitting pin captures NOTHING — type-to-room stays ephemeral", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: null,
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(6) },
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "just a passing thought" }));

    expect(res.status).toBe(200);
    expect(pinPredictedSignature).not.toHaveBeenCalled();
  });

  it("persist:true writes the sealed verdict to the thread (survives reload, Phase D)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // A client whose threads.update→eq resolves ok and captures the payload; profiles select works.
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
      from: vi.fn((table: string) =>
        table === "threads"
          ? { update }
          : {
              select: () => ({
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: { niche_primary: "fitness" }, error: null }) }),
              }),
            },
      ),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: null, // General → no getAudience; the seal still writes
      sim_seals: { "an older card": { pct: 30, band: "Weak", at: "old" } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(6) }, // 6/10 stop → 60%, band Strong
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "  my new hook  ", persist: true }));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0]![0] as { sim_seals: Record<string, { pct: number; band: string }> };
    // merged (older seal kept) + the new one keyed by the TRIMMED stimulus
    expect(payload.sim_seals["an older card"]).toEqual({ pct: 30, band: "Weak", at: "old" });
    expect(payload.sim_seals["my new hook"]!.pct).toBe(60);
    expect(payload.sim_seals["my new hook"]!.band).toBe("Strong");
    expect(eq).toHaveBeenCalledWith("id", "thread-1");
  });

  it("omitting persist writes NO seal — type-to-room leaves the thread untouched", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
      from: vi.fn((table: string) =>
        table === "threads"
          ? { update }
          : {
              select: () => ({
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: { niche_primary: "fitness" }, error: null }) }),
              }),
            },
      ),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: null,
      sim_seals: {},
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonas(6) },
      warnings: [],
    });

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "just a thought" }));

    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 502 { error: 'reaction_failed' } when the Flash primitive throws", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockAuthedClient());
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-1",
      active_audience_id: null,
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("runFlashTextMode: call failed — boom"),
    );

    const { POST } = await import("@/app/api/tools/react/route");
    const res = await POST(makeRequest({ text: "this will fail" }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("reaction_failed");
  });
});
