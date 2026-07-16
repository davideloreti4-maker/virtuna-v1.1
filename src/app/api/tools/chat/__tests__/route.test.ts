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
  // Title write is best-effort/write-once — resolve false ("already titled").
  setThreadTitleIfEmpty: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/tools/runners/chat-runner", () => ({
  runChatPipeline: vi.fn(),
  isColdStart: vi.fn(),
}));

vi.mock("@/lib/tools/skill-dispatch", () => ({
  runSkillDispatch: vi.fn(),
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
    // Default-off flag — each dispatch test opts in explicitly (byte-identical path otherwise).
    delete process.env.CHAT_AGENT_DISPATCH;
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

  it("Test 5: MEET-MODE with NO open thread runs EPHEMERAL — no thread created, nothing persisted, client priorTurns reach the runner", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy, getOpenThread } = await import("@/lib/threads/threads");
    const { insertMessage, loadMessages } = await import("@/lib/threads/messages");
    const { runChatPipeline, isColdStart } = await import("@/lib/tools/runners/chat-runner");
    const { ARCHETYPES } = await import("@/lib/engine/wave3/persona-registry");
    const archetype = ARCHETYPES[0]!;

    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(
      async (_input: unknown, onToken: (d: string) => void) => {
        onToken("Hi, I'm Maya");
        return { fullContent: "Hi, I'm Maya", coldStart: false };
      },
    );
    (isColdStart as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-meet-1" });
    // Fresh "New Thread" state: no open thread row exists yet (sentinel pointer).
    (getOpenThread as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const mockChain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-meet" } } }) },
      ...mockChain,
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(
      makeChatRequest({
        ask: "And why is that?",
        platform: "tiktok",
        // Meet-mode: archetype + name, NO reactionToConcept, NO conceptText.
        personaGrounding: { archetype, personaName: "Maya" },
        // The drawer's in-session transcript (ephemeral context).
        priorTurns: [
          { role: "user", text: "What makes you stop scrolling?" },
          { role: "assistant", text: "Mid-chaos entries." },
        ],
      }),
    );
    expect(res.status).toBe(200);
    await readSSE(res);

    // The runner received the meet grounding (NOT degraded to open chat).
    const runnerInput = (runChatPipeline as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as {
      personaGrounding?: { archetype: string; personaName?: string; reactionToConcept?: unknown };
      priorTurns?: Array<{ role: string; text: string }>;
    };
    expect(runnerInput.personaGrounding).toBeDefined();
    expect(runnerInput.personaGrounding!.archetype).toBe(archetype);
    expect(runnerInput.personaGrounding!.personaName).toBe("Maya");
    expect(runnerInput.personaGrounding!.reactionToConcept).toBeUndefined();
    // Client-carried context reached the runner (the fenced anchor path).
    expect(runnerInput.priorTurns).toEqual([
      { role: "user", text: "What makes you stop scrolling?" },
      { role: "assistant", text: "Mid-chaos entries." },
    ]);

    // EPHEMERAL: no thread was created and nothing was persisted.
    expect(createOpenThreadLazy as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(insertMessage as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("Test 5b: MEET-MODE with an open thread persists both turns as persona-chat-turn (continuity with ask-why)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy, getOpenThread } = await import("@/lib/threads/threads");
    const { insertMessage, loadMessages } = await import("@/lib/threads/messages");
    const { runChatPipeline, isColdStart } = await import("@/lib/tools/runners/chat-runner");
    const { ARCHETYPES } = await import("@/lib/engine/wave3/persona-registry");
    const archetype = ARCHETYPES[0]!;

    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(
      async (_input: unknown, onToken: (d: string) => void) => {
        onToken("Hi again");
        return { fullContent: "Hi again", coldStart: false };
      },
    );
    (isColdStart as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-meet-2" });
    // A real thread is open (cookie points at it) — meet turns join its sub-thread.
    (getOpenThread as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-meet-2",
      user_id: "user-meet",
    });

    const mockChain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-meet" } } }) },
      ...mockChain,
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(
      makeChatRequest({
        ask: "What makes you stop scrolling?",
        platform: "tiktok",
        personaGrounding: { archetype, personaName: "Maya" },
      }),
    );
    expect(res.status).toBe(200);
    await readSSE(res);

    // Still never CREATES a thread in meet-mode; it reuses the pointed one.
    expect(createOpenThreadLazy as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();

    // Both turns persist as persona-chat-turn blocks on that thread (the per-person sub-thread).
    const insertCalls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, string, Array<{ type: string; props: { archetype: string } }>]
    >;
    expect(insertCalls.length).toBe(2);
    for (const [threadId, , blocks] of insertCalls) {
      expect(threadId).toBe("thread-meet-2");
      expect(blocks[0]!.type).toBe("persona-chat-turn");
      expect(blocks[0]!.props.archetype).toBe(archetype);
    }
  });

  it("Test 6: PARTIAL grounding (reaction present, conceptText empty) still degrades to open chat — no half-applied voice", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage, loadMessages } = await import("@/lib/threads/messages");
    const { runChatPipeline, isColdStart } = await import("@/lib/tools/runners/chat-runner");
    const { ARCHETYPES } = await import("@/lib/engine/wave3/persona-registry");

    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(
      async (_input: unknown, onToken: (d: string) => void) => {
        onToken("open answer");
        return { fullContent: "open answer", coldStart: false };
      },
    );
    (isColdStart as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-partial-1" });

    const mockChain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-partial" } } }) },
      ...mockChain,
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-partial-1",
      user_id: "user-partial",
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(
      makeChatRequest({
        ask: "Why?",
        platform: "tiktok",
        personaGrounding: {
          archetype: ARCHETYPES[0]!,
          reactionToConcept: { verdict: "stop", quote: "loved it" },
          conceptText: "", // reaction WITHOUT a concept = malformed → open chat
        },
      }),
    );
    expect(res.status).toBe(200);
    await readSSE(res);

    const runnerInput = (runChatPipeline as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as { personaGrounding?: unknown };
    expect(runnerInput.personaGrounding).toBeUndefined();
  });

  // ─── Chat-as-agent dispatch (CHAT_AGENT_DISPATCH, default OFF) ────────────────

  /** Standard authed harness with a resolvable open thread + null profile. */
  async function primeDispatchHarness(userId = "user-dispatch", threadId = "thread-dispatch") {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage, loadMessages } = await import("@/lib/threads/messages");
    const { isColdStart } = await import("@/lib/tools/runners/chat-runner");

    (isColdStart as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-d" });

    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
      ...chain,
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({ id: threadId, user_id: userId });
    return { threadId };
  }

  const IDEA_BLOCK = (title: string) => ({
    type: "idea-card",
    props: { title, angle: "a", whyItFits: "b", mechanism: "c", seedHook: `h-${title}`, needsTake: false, topic: "t", take: "", format: null, band: "Strong", fraction: "4/5", scored: true, scrollQuote: "q", model: "sim1-flash" },
  });

  it("Test 6: dispatch ON + skill ran → streams block events + closing token; persists cards + markdown; runChatPipeline NOT called", async () => {
    process.env.CHAT_AGENT_DISPATCH = "true";
    const { threadId } = await primeDispatchHarness();
    const { runSkillDispatch } = await import("@/lib/tools/skill-dispatch");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");

    (runSkillDispatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: "I made 2 angles — want hooks for one?",
      skillRuns: [{ name: "generate_ideas", blocks: [IDEA_BLOCK("A"), IDEA_BLOCK("B")], warnings: [] }],
      toolCalls: [{ name: "generate_ideas", args: { topic: "morning routines" }, ran: true }],
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "give me 3 ideas about morning routines", platform: "tiktok" }));
    expect(res.status).toBe(200);
    const raw = await readSSE(res);

    // Each card streamed as a block event; the co-pilot line as a token; then done.
    expect((raw.match(/event: block/g) ?? []).length).toBe(2);
    expect(raw).toContain('"idea-card"');
    expect(raw).toContain("event: token");
    expect(raw).toContain("event: done");

    // The grounded pipeline is skipped when a skill ran (no double-answer).
    expect(runChatPipeline).not.toHaveBeenCalled();

    // Persistence: the card blocks (one assistant message) + the closing markdown (another).
    const calls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls as Array<[string, string, unknown[], string?]>;
    const assistantCalls = calls.filter(([tid, role]) => tid === threadId && role === "assistant");
    const cardCall = assistantCalls.find(([, , blocks]) => (blocks[0] as { type?: string })?.type === "idea-card");
    expect(cardCall).toBeDefined();
    expect((cardCall![2] as unknown[]).length).toBe(2);
    const markdownCall = assistantCalls.find(([, , blocks]) => (blocks[0] as { type?: string })?.type === "markdown");
    expect(markdownCall).toBeDefined();
    expect((markdownCall![2][0] as { props: { text: string } }).props.text).toBe("I made 2 angles — want hooks for one?");
  });

  it("Test 7: dispatch ON but NO skill ran → falls back to grounded runChatPipeline (pure chat not degraded)", async () => {
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runSkillDispatch } = await import("@/lib/tools/skill-dispatch");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");

    (runSkillDispatch as ReturnType<typeof vi.fn>).mockResolvedValue({ text: "", skillRuns: [], toolCalls: [] });
    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(async (_input: unknown, onToken: (d: string) => void) => {
      onToken("grounded answer");
      return { fullContent: "grounded answer", coldStart: false };
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "what actually makes a good hook?", platform: "tiktok" }));
    expect(res.status).toBe(200);
    const raw = await readSSE(res);

    expect(runSkillDispatch).toHaveBeenCalledTimes(1);
    expect(runChatPipeline).toHaveBeenCalledTimes(1); // the fallback ran
    expect(raw).not.toContain("event: block");
    expect(raw).toContain("event: token");
    expect(raw).toContain("event: done");
  });

  it("Test 8: dispatch flag OFF → runSkillDispatch never called (byte-identical to shipped chat)", async () => {
    await primeDispatchHarness();
    const { runSkillDispatch } = await import("@/lib/tools/skill-dispatch");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");
    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(async (_input: unknown, onToken: (d: string) => void) => {
      onToken("answer");
      return { fullContent: "answer", coldStart: false };
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "what should I post?", platform: "tiktok" }));
    expect(res.status).toBe(200);
    await readSSE(res);

    expect(runSkillDispatch).not.toHaveBeenCalled();
    expect(runChatPipeline).toHaveBeenCalledTimes(1);
  });

  it("Test 9: dispatch ON but persona/meet mode → dispatch SKIPPED, persona answer path runs", async () => {
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runSkillDispatch } = await import("@/lib/tools/skill-dispatch");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");
    const { ARCHETYPES } = await import("@/lib/engine/wave3/persona-registry");
    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(async (_input: unknown, onToken: (d: string) => void) => {
      onToken("in-voice reply");
      return { fullContent: "in-voice reply", coldStart: false };
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(
      makeChatRequest({
        ask: "why did you scroll?",
        platform: "tiktok",
        personaGrounding: {
          archetype: ARCHETYPES[0]!,
          reactionToConcept: { verdict: "scroll", quote: "meh" },
          conceptText: "a concept they reacted to",
        },
      }),
    );
    expect(res.status).toBe(200);
    await readSSE(res);

    // Persona chat never orchestrates skills — dispatch is bypassed entirely.
    expect(runSkillDispatch).not.toHaveBeenCalled();
    expect(runChatPipeline).toHaveBeenCalledTimes(1);
  });
});
