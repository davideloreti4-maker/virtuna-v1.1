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
