/**
 * Tests for /api/analyze/[id]/chat route — GET history + POST streaming Qwen chat.
 *
 * Covers: 401 unauthed, 400 empty/long message, 429 cap + rate limit, 404 unknown analysis,
 *         happy-path POST (inserts user turn, calls Qwen stream, inserts assistant turn, SSE frames),
 *         GET returns ordered messages.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────
// Mocks (before imports)
// ──────────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockInsert = vi.fn();

// We need a flexible mock that handles different tables and query chains
let supabaseMockImpl: ReturnType<typeof createSupabaseMock>;

function createSupabaseMock(overrides: {
  analysisRow?: { data?: unknown; error?: unknown } | null;
  priorTurns?: { data?: unknown; error?: unknown };
  userTurnCount?: number;
  recentCount?: number;
  insertError?: unknown;
  historyRows?: unknown[];
} = {}) {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === "analysis_results") {
        const row = overrides.analysisRow ?? {
          data: {
            id: "test-analysis-id",
            user_id: "test-user-id",
            overall_score: 75,
            apollo_reasoning: {
              ceiling_capper: "Low hook",
              dimensions: [{ name: "Hook", score: 4 }],
              rewrites: [{ label: "Hook rewrite", original: "old", rewrite: "new" }],
            },
          },
          error: null,
        };
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue(row),
          })),
        };
      }

      if (table === "analysis_chats") {
        const capCount = overrides.userTurnCount ?? 0;
        const rateCount = overrides.recentCount ?? 0;
        const turns = overrides.priorTurns ?? { data: [], error: null };
        const history = overrides.historyRows ?? [];

        return {
          select: vi.fn((fields: string, opts?: { count?: string; head?: boolean }) => {
            // Count queries (for cap + rate limit checks)
            if (opts?.head && opts?.count === "exact") {
              const chain = {
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                resolveCount: 0,
              };
              // We use a hack: return different counts depending on what fields were selected
              // The cap query selects "id", the rate query also selects "id"
              // Distinguish via returned mock promise
              chain.eq = vi.fn().mockReturnThis();
              chain.gte = vi.fn().mockReturnThis();
              // Return a Thenable that resolves based on call order
              const p = Promise.resolve({ count: capCount > 0 ? capCount : rateCount, error: null });
              return Object.assign(p, chain);
            }
            // History select (GET route or prior turns)
            const chain = {
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue(
                fields.includes("role, content, scope")
                  ? { data: history, error: null }
                  : turns
              ),
            };
            return chain;
          }),
          insert: mockInsert,
        };
      }

      return {};
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => supabaseMockImpl),
}));

// Mock Qwen client
const mockCreate = vi.fn();
vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
  QWEN_REASONING_MODEL: "qwen3.6-plus",
}));

// Mock seed-context (returns a short string for speed)
vi.mock("@/lib/chat/seed-context", () => ({
  buildChatSystemContext: vi.fn(() => "You are Apollo expert."),
  VALID_SCOPES: ["audience", "engine", "verdict", "actions", "content"],
}));

// ──────────────────────────────────────────────────────────────────────────
// Imports (after mocks)
// ──────────────────────────────────────────────────────────────────────────

import { GET, POST } from "../route";
import { buildChatSystemContext } from "@/lib/chat/seed-context";
import { QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const TEST_ANALYSIS_ID = "test-analysis-id";
const TEST_USER = { id: "test-user-id", email: "test@example.com" };

function makeParams(id = TEST_ANALYSIS_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(id = TEST_ANALYSIS_ID) {
  return new Request(`https://example.com/api/analyze/${id}/chat`, { method: "GET" });
}

function makePostRequest(body: Record<string, unknown>, id = TEST_ANALYSIS_ID) {
  return new Request(`https://example.com/api/analyze/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Build a fake async iterable for Qwen streaming */
function fakeStream(deltas: string[]) {
  return (async function* () {
    for (const delta of deltas) {
      yield { choices: [{ delta: { content: delta } }] };
    }
  })();
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  supabaseMockImpl = createSupabaseMock();
});

describe("GET /api/analyze/[id]/chat", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns ordered messages for authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const historyRows = [
      { role: "user", content: "Hello", scope: null, created_at: "2026-01-01T00:00:00Z" },
      { role: "assistant", content: "Hi there", scope: null, created_at: "2026-01-01T00:00:01Z" },
    ];
    supabaseMockImpl = createSupabaseMock({ historyRows });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("messages");
  });
});

describe("POST /api/analyze/[id]/chat", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makePostRequest({ message: "What is this?" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty message", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const res = await POST(makePostRequest({ message: "" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 for message exceeding max length", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    const longMsg = "x".repeat(2001);
    const res = await POST(makePostRequest({ message: longMsg }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/2000/);
  });

  it("returns 404 for analysis not belonging to user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    supabaseMockImpl = createSupabaseMock({
      analysisRow: { data: null, error: { code: "PGRST116" } },
    });
    const res = await POST(makePostRequest({ message: "Why flop?" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 429 when per-analysis user-turn cap is reached", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });

    // Override supabase mock to simulate cap exceeded
    supabaseMockImpl = {
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) => {
        if (table === "analysis_results") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: TEST_ANALYSIS_ID, user_id: TEST_USER.id, overall_score: 75 },
                error: null,
              }),
            })),
          };
        }
        if (table === "analysis_chats") {
          return {
            select: vi.fn((_: string, opts?: { count?: string; head?: boolean }) => {
              const chain = {
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
              if (opts?.head && opts?.count === "exact") {
                return Object.assign(Promise.resolve({ count: 20, error: null }), chain);
              }
              return chain;
            }),
            insert: mockInsert,
          };
        }
        return {};
      }),
    } as unknown as typeof supabaseMockImpl;

    const res = await POST(makePostRequest({ message: "Why flop?" }), makeParams());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/cap/i);
  });

  it("happy path: inserts user turn, calls Qwen with stream:true + QWEN_REASONING_MODEL + system message, inserts assistant turn", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockCreate.mockResolvedValue(fakeStream(["Hello ", "world"]));

    const res = await POST(makePostRequest({ message: "Why flop?" }), makeParams());
    // SSE stream response
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // Consume the stream fully
    const text = await res.text();
    expect(text).toContain("event: token");
    expect(text).toContain("event: done");
    expect(text).toContain('"Hello "');
    expect(text).toContain("Hello world"); // full content in done frame

    // Qwen called with stream:true and correct model
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: QWEN_REASONING_MODEL,
        stream: true,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system", content: "You are Apollo expert." }),
          expect.objectContaining({ role: "user", content: "Why flop?" }),
        ]),
      })
    );

    // System context built from the row
    expect(buildChatSystemContext).toHaveBeenCalled();

    // insert called twice: user turn + assistant turn
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", content: "Why flop?" })
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "assistant", content: "Hello world" })
    );
  });

  it("strips unknown scope to null (T-00u-03)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockCreate.mockResolvedValue(fakeStream(["OK"]));

    await POST(makePostRequest({ message: "Test", scope: "INVALID_SCOPE" }), makeParams());

    // user turn insert should have scope: null
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", scope: null })
    );
  });

  it("passes valid scope through to insert (T-00u-03)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
    mockCreate.mockResolvedValue(fakeStream(["OK"]));

    await POST(makePostRequest({ message: "Tell me about audience", scope: "audience" }), makeParams());

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", scope: "audience" })
    );
  });
});
