/**
 * Plan 01-03 T2 — assertions for GET /api/analyze/[id]/stream
 * (D-04 EventSource-compatible endpoint).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const singleMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-a" } } })) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: singleMock,
    })),
  })),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// The roster resolves the audience the way the ENGINE does: thread pin → getAudience →
// General. Both are mocked per-test; the default (no thread pin) is the General path, which
// is what a live uncalibrated run hits.
const getOpenThreadMock = vi.fn(async () => null as unknown);
const getAudienceMock = vi.fn(async () => null as unknown);

vi.mock("@/lib/threads/threads", () => ({
  getOpenThread: (...args: unknown[]) => getOpenThreadMock(...(args as [])),
}));

vi.mock("@/lib/audience/audience-repo", () => ({
  getAudience: (...args: unknown[]) => getAudienceMock(...(args as [])),
  GENERAL_AUDIENCE: { id: "general", is_general: true, personas: [] },
}));

function buildReq(id = "abc"): Request {
  return new Request(`http://localhost/api/analyze/${id}/stream`);
}

async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

beforeEach(() => {
  singleMock.mockReset();
  vi.clearAllMocks();
  getOpenThreadMock.mockResolvedValue(null);
  getAudienceMock.mockResolvedValue(null);
});

describe("GET /api/analyze/[id]/stream", () => {
  it("returns 401 when no Supabase session", async () => {
    const server = await import("@/lib/supabase/server");
    (server.createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      from: vi.fn(),
    });
    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when row missing", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: "no row" } });
    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("missing-id"), { params: Promise.resolve({ id: "missing-id" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Analysis not found");
  });

  it("returns 404 when row exists but wrong user_id (filter eliminates row → 'no row found')", async () => {
    // Mocked .single returns null because the user_id filter would exclude wrong-owner rows.
    // Response is INDISTINGUISHABLE from missing-row case (enumeration prevention — T-01-GET-tenant-guess).
    singleMock.mockResolvedValueOnce({ data: null, error: null });
    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("other-user-row"), { params: Promise.resolve({ id: "other-user-row" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 with Content-Type: text/event-stream on valid terminal-state request", async () => {
    singleMock.mockResolvedValueOnce({
      data: { id: "abc", user_id: "user-a", overall_score: 0.8, confidence: 0.7, deleted_at: null },
      error: null,
    });
    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
  });

  it("emits single event:complete frame when row.overall_score !== null", async () => {
    singleMock.mockResolvedValueOnce({
      data: { id: "abc", user_id: "user-a", overall_score: 0.8, confidence: 0.7, deleted_at: null },
      error: null,
    });
    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    const body = await readAll(res);
    const completeMatches = body.match(/event: complete/g) ?? [];
    expect(completeMatches.length).toBe(1);
    expect(body).toContain("id: complete");
    expect(body).toContain('"overall_score":0.8');
  });

  it("emits event:complete when in-flight row eventually settles", async () => {
    const inFlight = { id: "abc", user_id: "user-a", overall_score: null, confidence: null, deleted_at: null };
    const settled = { id: "abc", user_id: "user-a", overall_score: 0.55, confidence: 0.6, deleted_at: null };
    singleMock
      .mockResolvedValueOnce({ data: inFlight, error: null })   // initial lookup → in-flight
      .mockResolvedValueOnce({ data: inFlight, error: null })   // first poll → still in-flight
      .mockResolvedValueOnce({ data: settled, error: null });   // second poll → settled

    // Speed up poll interval for test — monkey-patch setTimeout for this test
    const origST = global.setTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = (cb: () => void) => origST(cb, 0);

    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    const body = await readAll(res);
    expect(body).toContain("event: complete");
    expect(body).toContain('"overall_score":0.55');

    // restore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = origST;
  });

  it("emits a roster on a society_id:null row — the shape of EVERY live row", async () => {
    // THE REGRESSION THIS PINS: the roster used to be looked up from `row.society_id`, and
    // nothing writes that column — the Read submit path sends only input_mode/content_type/
    // tiktok_url. So it is null on every real row and the roster event NEVER fired outside a
    // fixture. Caught by watching a live run (row iEbgUsLZRSFw, 2026-07-14): zero roster events.
    // An uncalibrated user must still see the General cast — the 10 archetypes the fold runs.
    const inFlight = {
      id: "abc", user_id: "user-a", overall_score: null, confidence: null,
      deleted_at: null, society_id: null,
    };
    const settled = { id: "abc", user_id: "user-a", overall_score: 0.55, confidence: 0.6, deleted_at: null };
    singleMock
      .mockResolvedValueOnce({ data: inFlight, error: null })
      .mockResolvedValueOnce({ data: inFlight, error: null })
      .mockResolvedValueOnce({ data: settled, error: null });

    const origST = global.setTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = (cb: () => void) => origST(cb, 0);

    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    const body = await readAll(res);

    expect(body).toContain("event: roster");
    // The General cast the fold actually simulates — 10 archetypes, no invented names.
    const rosterFrame = body.split("event: roster")[1]!.split("\n\n")[0]!;
    const payload = JSON.parse(rosterFrame.replace(/^\ndata: /, ""));
    expect(payload.personas).toHaveLength(10);
    expect(payload.personas[0]).toEqual({ archetype: "high_engager", label: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = origST;
  });

  it("prefers the thread's calibrated audience — the same one the engine folds", async () => {
    getOpenThreadMock.mockResolvedValue({ id: "t1", active_audience_id: "aud-1" });
    getAudienceMock.mockResolvedValue({
      id: "aud-1",
      personas: [
        { archetype: "high_engager", label: "Skincare Sam" },
        { archetype: "lurker", label: null },
      ],
    });
    const inFlight = {
      id: "abc", user_id: "user-a", overall_score: null, confidence: null,
      deleted_at: null, society_id: null,
    };
    const settled = { id: "abc", user_id: "user-a", overall_score: 0.55, confidence: 0.6, deleted_at: null };
    singleMock
      .mockResolvedValueOnce({ data: inFlight, error: null })
      .mockResolvedValueOnce({ data: inFlight, error: null })
      .mockResolvedValueOnce({ data: settled, error: null });

    const origST = global.setTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = (cb: () => void) => origST(cb, 0);

    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    const body = await readAll(res);

    const rosterFrame = body.split("event: roster")[1]!.split("\n\n")[0]!;
    const payload = JSON.parse(rosterFrame.replace(/^\ndata: /, ""));
    expect(payload.personas).toEqual([
      { archetype: "high_engager", label: "Skincare Sam" },
      { archetype: "lurker", label: null },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = origST;
  });

  it("emits filmstrip_segment_ready from variants.filmstrip_segments (not heatmap.segments)", async () => {
    // Regression guard: the extract route persists keyframes to
    // analysis_results.variants.filmstrip_segments. If the SSE poll reads the wrong
    // field (the old heatmap.segments) no event is emitted and keyframes stay blank
    // on live runs until a reload. This row only carries the variants field.
    const inFlight = { id: "abc", user_id: "user-a", overall_score: null, confidence: null, deleted_at: null };
    const withFilmstrip = {
      ...inFlight,
      variants: { filmstrip_segments: [{ idx: 0, keyframe_uri: "https://cdn/0.jpg" }] },
    };
    const settled = { id: "abc", user_id: "user-a", overall_score: 0.55, confidence: 0.6, deleted_at: null };
    singleMock
      .mockResolvedValueOnce({ data: inFlight, error: null })       // initial lookup → in-flight
      .mockResolvedValueOnce({ data: withFilmstrip, error: null })  // poll 1 → keyframe ready
      .mockResolvedValueOnce({ data: settled, error: null });       // poll 2 → settled

    const origST = global.setTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = (cb: () => void) => origST(cb, 0);

    const { GET } = await import("@/app/api/analyze/[id]/stream/route");
    const res = await GET(buildReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    const body = await readAll(res);

    expect(body).toContain("event: filmstrip_segment_ready");
    expect(body).toContain('"segment_idx":0');
    expect(body).toContain('"keyframe_uri":"https://cdn/0.jpg"');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = origST;
  });
});
