/**
 * route.test.ts — POST /api/tools/chat integration tests (Plan 05-01, Task 2).
 *
 * Behavior tests:
 *   1. POST with no auth session → 401 (auth gate before any DB read).
 *   2. POST with `ask` exceeding 2000 chars → 400 (server-side cap, independent of client).
 *   3. POST with a valid ask (mocked Qwen stream + mocked threads/messages) → SSE emits
 *      `event: token` frames then `event: done`, and `insertMessage` is called with
 *      role `"assistant"` and a single `{type:"markdown", props:{text}}` block.
 *   4. POST with a null/thin profile (mocked runner returns `coldStart:true`) → SSE emits
 *      `event: meta { coldStart: true }`; POST with a full profile (`coldStart:false`) →
 *      `event: meta { coldStart: false }`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
  loadMessages: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
  getOpenThread: vi.fn(),
}));

vi.mock("@/lib/tools/runners/chat-runner", () => ({
  runChatPipeline: vi.fn(),
  isColdStart: vi.fn(),
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
  withKcStamp: vi.fn((obj: Record<string, unknown>) => ({
    ...obj,
    kcGenVersion: "gen.1.0.0",
  })),
  KC_PROVENANCE_FIELD: "kcGenVersion",
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChatRequest(body: unknown) {
  return new Request("http://localhost/api/tools/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function readSSE(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  return output;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/chat (SSE route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: returns 401 when user is not authenticated (auth gate before any DB read)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "What should I post?" }));
    expect(res.status).toBe(401);
  });

  it("Test 2: returns 400 when ask exceeds 2000 chars (server-side cap)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "x".repeat(2001), platform: "tiktok" }));
    expect(res.status).toBe(400);
  });

  it("Test 3: valid ask → SSE emits token frames then done; insertMessage called with assistant markdown block", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage, loadMessages } = await import("@/lib/threads/messages");
    const { runChatPipeline, isColdStart } = await import(
      "@/lib/tools/runners/chat-runner"
    );

    const mockUser = { id: "user-abc" };
    const mockThread = { id: "thread-open-123", user_id: "user-abc" };
    const fullContent = "Here is a grounded markdown answer";

    // Mock runChatPipeline: invoke the onToken callback for each word, then return result
    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(
      async (
        _input: unknown,
        onToken: (delta: string) => void,
      ) => {
        onToken("Here ");
        onToken("is ");
        onToken("a grounded markdown answer");
        return { fullContent, coldStart: false };
      },
    );
    (isColdStart as ReturnType<typeof vi.fn>).mockReturnValue(false);

    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-chat-xyz" });

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "What should I post?", platform: "tiktok" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const rawOutput = await readSSE(res);

    // Must emit token events
    expect(rawOutput).toContain("event: token");
    // Must emit done event
    expect(rawOutput).toContain("event: done");

    // insertMessage called with "assistant" role + markdown block
    const insertCalls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, string, unknown[], string?]
    >;
    const assistantCall = insertCalls.find(([, role]) => role === "assistant");
    expect(assistantCall).toBeDefined();
    const blocks = assistantCall![2] as Array<{ type: string; props: { text: string } }>;
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBe(1);
    const block = blocks[0]!;
    expect(block.type).toBe("markdown");
    expect(block.props.text).toBe(fullContent);
  });

  it("Test 4: coldStart signal — null/thin profile emits meta{coldStart:true}; full profile emits meta{coldStart:false}", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage, loadMessages } = await import("@/lib/threads/messages");
    const { runChatPipeline, isColdStart } = await import(
      "@/lib/tools/runners/chat-runner"
    );

    const mockUser = { id: "user-xyz" };
    const mockThread = { id: "thread-cold-456", user_id: "user-xyz" };

    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-cold-1" });

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);

    // ── Sub-test A: coldStart = true ──────────────────────────────────────
    (isColdStart as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(
      async (_input: unknown, onToken: (d: string) => void) => {
        onToken("response");
        return { fullContent: "response", coldStart: true };
      },
    );

    const { POST } = await import("@/app/api/tools/chat/route");
    const resA = await POST(makeChatRequest({ ask: "Chat with thin profile", platform: "tiktok" }));
    const rawA = await readSSE(resA);

    // meta event must be present with coldStart: true
    expect(rawA).toContain("event: meta");
    expect(rawA).toContain('"coldStart":true');

    vi.clearAllMocks();
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-full-2" });
    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);

    // ── Sub-test B: coldStart = false ─────────────────────────────────────
    (isColdStart as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(
      async (_input: unknown, onToken: (d: string) => void) => {
        onToken("full response");
        return { fullContent: "full response", coldStart: false };
      },
    );

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);

    const resB = await POST(makeChatRequest({ ask: "Chat with full profile", platform: "tiktok" }));
    const rawB = await readSSE(resB);

    expect(rawB).toContain("event: meta");
    expect(rawB).toContain('"coldStart":false');
  });
});
