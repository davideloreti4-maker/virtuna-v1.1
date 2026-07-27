/**
 * route.test.ts — GET /api/threads/open tests (Plan 04-03, Task 3).
 *
 * Tests:
 *   - 401 when unauthenticated (T-04-10)
 *   - Returns empty messages array when user has no open thread
 *   - Returns hydrated messages (threadId + blocks) when open thread exists
 *   - Re-validates blocks on rehydration; invalid blocks become unsupported sentinel (D-14)
 *
 * This is the RED test gate — the route does not exist yet.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HydratedMessage } from "@/lib/threads/messages";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  getOpenThread: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  loadMessages: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getOpenThread } from "@/lib/threads/threads";
import { loadMessages } from "@/lib/threads/messages";

const mockGetOpenThread = getOpenThread as ReturnType<typeof vi.fn>;
const mockLoadMessages = loadMessages as ReturnType<typeof vi.fn>;
const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabase(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

async function callGET(): Promise<Response> {
  const { GET } = await import("../route");
  const req = new Request("http://localhost/api/threads/open");
  return GET(req);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/threads/open — auth gate (T-04-10)", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null));
    const res = await callGET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("GET /api/threads/open — no open thread", () => {
  it("returns empty messages array when user has no open thread", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
    mockGetOpenThread.mockResolvedValue(null); // no thread

    const res = await callGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ messages: [] });
  });
});

describe("GET /api/threads/open — with open thread", () => {
  it("returns threadId + hydrated messages when open thread exists", async () => {
    const threadId = "thread-abc";
    mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
    mockGetOpenThread.mockResolvedValue({ id: threadId, type: "open", user_id: "user-1", reading_id: null });

    const hydratedMessages: HydratedMessage[] = [
      {
        id: "msg-1",
        thread_id: threadId,
        role: "assistant",
        created_at: "2026-06-18T10:00:00Z",
        blocks: [
          {
            type: "hook-card",
            props: {
              hookLine: "Why protein timing is a myth",
              audienceArchetype: "Stops the skeptic",
              mechanism: "Challenges a belief with specificity",
              seedHook: "protein timing myth",
              rank: 1,
              band: "Strong" as const,
              fraction: "8/10 stop",
              scrollQuote: "Wait, I thought you had to eat within 30 minutes…",
              model: "sim1-flash" as const,
              channel: null,
            },
          },
        ],
      },
    ];
    mockLoadMessages.mockResolvedValue(hydratedMessages);

    const res = await callGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threadId).toBe(threadId);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].blocks[0].type).toBe("hook-card");
  });

  it("calls loadMessages with the thread id (D-14 re-validation)", async () => {
    const threadId = "thread-xyz";
    mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
    mockGetOpenThread.mockResolvedValue({ id: threadId, type: "open", user_id: "user-1", reading_id: null });
    mockLoadMessages.mockResolvedValue([]);

    await callGET();

    expect(mockLoadMessages).toHaveBeenCalledWith(threadId);
  });

  it("does NOT call loadMessages when no open thread (no unnecessary DB read)", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
    mockGetOpenThread.mockResolvedValue(null);

    await callGET();

    expect(mockLoadMessages).not.toHaveBeenCalled();
  });
});

// ─── The funnel wall — the verdict seal (ONBOARDING-FUNNEL-DESIGN.md §0b②) ────
// An anonymous /go visitor's thread seals must cross the wire WITHOUT the verdict:
// no would-stop %, no population, no attention curve, no intents. Only the free
// half (the run's identity + craft score) is transmitted — the sealed room renders
// from that and cannot leak what it never received. readSimSeals runs REAL here.

function makeSupabaseAnon(userId: string) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, is_anonymous: true } },
        error: null,
      }),
    },
  };
}

const WALL_SEALS = {
  "an-1": {
    pct: 61,
    band: "Strong",
    at: "2026-07-26T12:00:00Z",
    population: {
      total: 1000,
      stop: 380,
      scroll: 620,
      stopPct: 38,
      segments: [],
      reasons: [{ reason: "too-slow", count: 253 }],
    },
    video: {
      analysisId: "an-1",
      stopPct: 61,
      craftScore: 74,
      heatmap: {
        segments: [],
        personas: [],
        weighted_curve: [0.8, 0.4],
        weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
        weights_source: "default",
      },
    },
  },
  "a typed concept": {
    pct: 44,
    band: "Mixed",
    at: "2026-07-26T12:05:00Z",
    scrollQuote: "took too long",
  },
};

function wallThread() {
  return {
    id: "thread-wall",
    type: "open",
    user_id: "u",
    reading_id: null,
    sim_seals: WALL_SEALS,
  };
}

describe("GET /api/threads/open — the funnel wall (verdict seal, §0b②)", () => {
  it("an anonymous session receives NO verdict field in simSeals — only the free half", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseAnon("anon-1"));
    mockGetOpenThread.mockResolvedValue(wallThread());
    mockLoadMessages.mockResolvedValue([]);

    const res = await callGET();
    expect(res.status).toBe(200);
    const body = await res.json();

    // The free half survives: the run's identity + its craft score.
    expect(body.simSeals["an-1"]).toEqual({
      sealed: true,
      at: "2026-07-26T12:00:00Z",
      video: { analysisId: "an-1", craftScore: 74 },
    });
    // A concept seal's verdict IS the verdict — omitted entirely, the row rehydrates queued.
    expect(body.simSeals["a typed concept"]).toBeUndefined();
    // And no verdict token anywhere on the wire.
    const raw = JSON.stringify(body.simSeals);
    for (const token of ["pct", "population", "stopPct", "weighted_curve", "intents", "scrollQuote"]) {
      expect(raw).not.toContain(token);
    }
  });

  it("a REAL session keeps the full seals — the wall never narrows a customer", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
    mockGetOpenThread.mockResolvedValue(wallThread());
    mockLoadMessages.mockResolvedValue([]);

    const res = await callGET();
    const body = await res.json();
    expect(body.simSeals["an-1"].pct).toBe(61);
    expect(body.simSeals["an-1"].video.stopPct).toBe(61);
    expect(body.simSeals["an-1"].population.total).toBe(1000);
    expect(body.simSeals["a typed concept"].pct).toBe(44);
  });
});
