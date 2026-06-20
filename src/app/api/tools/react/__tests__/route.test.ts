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
    const call = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls[0];
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
    expect((getAudience as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe("aud-server-side");

    // The resolved audience's repaint reached the Flash call (4th arg).
    const call = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls[0];
    const audienceRepaint = call[3];
    expect(audienceRepaint).toEqual({ tough_crowd: "Skeptical regular" });
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
