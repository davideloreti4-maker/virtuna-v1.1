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

vi.mock("@/lib/tools/chat-agent-loop", () => ({
  runChatAgentStream: vi.fn(),
}));

// assembleBundle is called by the route to build the loop's grounded user message — keep it inert.
vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn((input: { ask?: string }) => input.ask ?? ""),
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
    // Dispatch ships default-ON (2026-07-17). These legacy tests exercise the runChatPipeline path, so
    // pin the flag OFF here; the dispatch tests below opt back IN with "true", and one test asserts the
    // unset-env default is ON.
    process.env.CHAT_AGENT_DISPATCH = "false";
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
  async function primeDispatchHarness(
    userId = "user-dispatch",
    threadId = "thread-dispatch",
    /** `/go` funnel visitor — the demo entitles one Test and nothing the agent can dispatch. */
    isAnonymous = false
  ) {
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
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: isAnonymous ? { id: userId, is_anonymous: true } : { id: userId } },
        }),
      },
      ...chain,
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({ id: threadId, user_id: userId });
    return { threadId };
  }

  const HOOK_BLOCK = (hookLine: string) => ({ type: "hook-card", props: { hookLine } });

  const IDEA_BLOCK = (title: string) => ({
    type: "idea-card",
    props: { title, angle: "a", whyItFits: "b", mechanism: "c", seedHook: `h-${title}`, needsTake: false, topic: "t", take: "", format: null, band: "Strong", fraction: "4/5", scored: true, scrollQuote: "q", model: "sim1-flash" },
  });

  it("Test 6: agent loop ran a skill → streams block events + text; persists cards + marked markdown; runChatPipeline NOT called", async () => {
    process.env.CHAT_AGENT_DISPATCH = "true";
    const { threadId } = await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");

    // The loop streams two cards (onBlock) then a closing line (onToken), and returns them for persistence.
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(async (input: { onBlock: (b: unknown) => void; onToken: (d: string) => void }) => {
      input.onBlock(IDEA_BLOCK("A"));
      input.onBlock(IDEA_BLOCK("B"));
      input.onToken("I made 2 angles — want hooks for one?");
      return {
        text: "I made 2 angles — want hooks for one?",
        skillRuns: [{ name: "generate_ideas", blocks: [IDEA_BLOCK("A"), IDEA_BLOCK("B")], warnings: [] }],
        uiBlocks: [], // the route persists uiBlocks (request_input fields) → mock must return the real shape
        toolCalls: [{ name: "generate_ideas", ran: true }],
      };
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "give me 3 ideas about morning routines", platform: "tiktok" }));
    expect(res.status).toBe(200);
    const raw = await readSSE(res);

    // Each card streamed as a block event; the closing line as a token; then done.
    expect((raw.match(/event: block/g) ?? []).length).toBe(2);
    expect(raw).toContain('"idea-card"');
    expect(raw).toContain("event: token");
    expect(raw).toContain("event: done");

    // The old grounded pipeline is never called — the loop IS the answer (no double-call).
    expect(runChatPipeline).not.toHaveBeenCalled();

    // Persistence: the card blocks (one assistant message) + the closing markdown, MARKED origin:chat-agent.
    const calls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls as Array<[string, string, unknown[], string?]>;
    const assistantCalls = calls.filter(([tid, role]) => tid === threadId && role === "assistant");
    const cardCall = assistantCalls.find(([, , blocks]) => (blocks[0] as { type?: string })?.type === "idea-card");
    expect(cardCall).toBeDefined();
    expect((cardCall![2] as unknown[]).length).toBe(2);
    const markdownCall = assistantCalls.find(([, , blocks]) => (blocks[0] as { type?: string })?.type === "markdown");
    expect(markdownCall).toBeDefined();
    expect((markdownCall![2][0] as { props: { text: string; origin?: string } }).props.text).toBe("I made 2 angles — want hooks for one?");
    // A turn that ran a skill marks the text so the thread reloads unified in the chat view.
    expect((markdownCall![2][0] as { props: { origin?: string } }).props.origin).toBe("chat-agent");
  });

  it("Test 6b: an ANONYMOUS /go visitor is not offered the PAID skills — chat's back door to the engine", async () => {
    // Chat is free on purpose, but the skills the agent can dispatch are NOT: ideas, hooks and
    // scripts are metered actions with their own gates and their own 402. The demo entitles ONE
    // Test and nothing else, so an anonymous visitor who asks chat for hooks must get an answer
    // in words, never a paid engine run — the wall on /api/tools/hooks is worthless if the same
    // pipeline is reachable by asking nicely.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness("anon-chat", "thread-anon-chat", true);
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("here's how I'd think about it");
        return { text: "here's how I'd think about it", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "give me 5 hooks about cold plunges", platform: "tiktok" }));
    expect(res.status).toBe(200);
    await readSSE(res);

    const [, deps] = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      { skills?: Array<{ name: string; paid: boolean }> },
    ];
    expect(deps?.skills, "an anonymous turn must bind an explicit skill list").toBeDefined();
    expect(deps!.skills!.some((s) => s.paid)).toBe(false);
    expect(deps!.skills!.map((s) => s.name)).not.toContain("generate_hooks");
  });

  it("Test 6c: a real user keeps every skill — the filter is anonymous-only", async () => {
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );

    const { POST } = await import("@/app/api/tools/chat/route");
    await readSSE(await POST(makeChatRequest({ ask: "give me 5 hooks", platform: "tiktok" })));

    const [, deps] = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      { skills?: unknown } | undefined,
    ];
    // No override at all → the loop's own default registry (every skill, paid included).
    expect(deps?.skills).toBeUndefined();
  });

  it("Test 6c2: the loop is handed the creator's RAW message, not just the prior turns", async () => {
    // The digest is built from `priorTurns`, which this route loads at step (6) — BEFORE it
    // persists the message being answered at step (7). So the turn holding the constraint
    // ("…but keep them under 30s") was structurally absent from the digest, and on a thread's
    // first generating turn the digest was empty. `currentAsk` is the only channel for it:
    // `ask` is assembleBundle's output, not the creator's words. Handoff §14.2.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );
    // The file-level assembleBundle mock is the identity, which would make `ask` and `currentAsk`
    // coincide and the last assertion vacuous. One call, one distinguishable bundle.
    const { assembleBundle } = await import("@/lib/kc/assembler");
    (assembleBundle as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => "GROUNDED BUNDLE — not the creator's words",
    );

    const ask = "give me hooks, but keep them under 30s";
    const { POST } = await import("@/app/api/tools/chat/route");
    await readSSE(await POST(makeChatRequest({ ask, platform: "tiktok" })));

    const [input] = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { currentAsk?: string; ask?: string; priorTurns?: Array<{ text: string }> },
    ];
    expect(input.currentAsk).toBe(ask);
    // …and it is genuinely not reachable any other way: the prior turns predate this message,
    // and `ask` is the assembled bundle.
    expect((input.priorTurns ?? []).some((t) => t.text === ask)).toBe(false);
    expect(input.ask).toBe("GROUNDED BUNDLE — not the creator's words");
  });

  it("Test 6d: the agent turn's bundle is NOT labelled 'chat' — the label talks the model out of dispatching", async () => {
    // REGRESSION. assembleBundle prints its `mode` into a header that lands in the USER message, and
    // the chat slice defines chat mode as conversational, NOT a generation surface (over-generating is
    // a named failure mode there). Right for the pure-chat path; on the agent path it overrode the
    // loop's dispatch-eagerly directive, so "give me hooks for X" was answered in prose with
    // generate_hooks bound and unused — measured 0/4 dispatches with "chat", 4/4 with any other label.
    // `mode` must STAY "chat" (it selects MODE_ROLES, i.e. the grounding content); only the label moves.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );

    const { POST } = await import("@/app/api/tools/chat/route");
    await readSSE(await POST(makeChatRequest({ ask: "give me 5 hooks", platform: "tiktok" })));

    const { assembleBundle } = await import("@/lib/kc/assembler");
    const [bundleInput] = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls.at(-1) as [
      { mode?: string; modeLabel?: string },
    ];
    expect(bundleInput.mode, "mode drives MODE_ROLES — the grounding must not change").toBe("chat");
    expect(bundleInput.modeLabel, "the agent path must override the header label").toBeDefined();
    expect(bundleInput.modeLabel).not.toBe("chat");
  });

  it("Test 6e: a thread's OWN past skill run reaches the loop as a run, not as bare prose", async () => {
    // REGRESSION — the thread that poisoned its own later turns. A dispatching turn persists as two
    // rows (the cards, then the closing line stamped origin:"chat-agent"), and only markdown crossed
    // into the anchor. So the model saw "Five hooks are on screen." with no trace of a tool call
    // anywhere, and asked for hooks again it reproduced the sentence and called NOTHING: zero cards
    // under a UI insisting five existed (confirmed live 2026-08-04; replaying the real thread
    // measured 1/3 dispatches shipped vs 3/3 with the runs carried). The loop turns `toolRuns` back
    // into the tool-call exchange it was — this pins that the route actually hands them over.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { loadMessages } = await import("@/lib/threads/messages");
    (loadMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "m1", thread_id: "t", role: "user", created_at: "1", blocks: [{ type: "markdown", props: { text: "hooks for my budgeting app" } }] },
      { id: "m2", thread_id: "t", role: "assistant", created_at: "2", blocks: [HOOK_BLOCK("a"), HOOK_BLOCK("b")] },
      { id: "m3", thread_id: "t", role: "assistant", created_at: "3", blocks: [{ type: "markdown", props: { text: "Two hooks are on screen.", origin: "chat-agent" } }] },
    ]);

    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );

    const { POST } = await import("@/app/api/tools/chat/route");
    await readSSE(await POST(makeChatRequest({ ask: "more hooks for it", platform: "tiktok" })));

    const [loopInput] = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { priorTurns?: Array<{ role: string; text: string; toolRuns?: Array<{ name: string; cards: number }> }> },
    ];
    expect(loopInput.priorTurns).toHaveLength(2); // the card row is not a turn of its own
    const announcing = loopInput.priorTurns!.at(-1)!;
    expect(announcing.text).toBe("Two hooks are on screen.");
    // …carrying the run that caused it AND the lines of the cards it produced. The lines are §6b:
    // with only a count, "Which of these hooks is strongest?" answered "I don't have the specific
    // hook lines in front of me" about cards the app had just rendered.
    expect(announcing.toolRuns, "the closing line must arrive with the run that caused it").toEqual([
      { name: "generate_hooks", cards: 2, topic: "hooks for my budgeting app", lines: ["a", "b"] },
    ]);
  });

  it("Test 6f: a tapped chip's declared skill reaches the loop; a typed ask carries none", async () => {
    // REGRESSION. A follow-up chip's sentence reads as subject-less on its own ("Give me a few more
    // hook options."), so the loop's directive classed it "too vague" and pushed back instead of
    // running — 0/3, and unchanged by the 6e fix above. The chip therefore declares its generator
    // (chat-followups.ts) and the loop pins tool_choice to it. This pins the WIRE: the route must
    // forward the field, and must NOT invent one for an ordinary typed message — which is the only
    // thing keeping the conversational asks byte-identical.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );
    const { POST } = await import("@/app/api/tools/chat/route");

    await readSSE(
      await POST(makeChatRequest({ ask: "Give me a few more hook options.", platform: "tiktok", skill: "hooks" })),
    );
    await readSSE(await POST(makeChatRequest({ ask: "which is strongest?", platform: "tiktok" })));

    const calls = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls as Array<[{ forceSkill?: string }]>;
    expect(calls[0]![0].forceSkill).toBe("hooks");
    // THE CONTROL — a typed ask must reach the loop with no pin at all.
    expect(calls[1]![0].forceSkill).toBeUndefined();
  });

  it("Test 6g: ENGINE_GUESS_PIN pins a typed generation ask to the guessed generator", async () => {
    // THE DISPATCH DEFECT, measured over 183 real generations: an ask whose SUBJECT is a product
    // or format dispatches 7/31 (23%), against 30/30 for a scenario subject (p = 5.4e-11). Four
    // prompt-only fixes failed to move it. This pins the WIRE for the structural one — the route
    // must forward `forceSkill` from the pre-router's guess when the flag is on, and must still
    // forward nothing when it is off, which is what keeps the shipped path byte-identical.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );
    const { POST } = await import("@/app/api/tools/chat/route");
    const ask = "give me 5 hooks for my student budgeting app";

    // THE CONTROL FIRST — flag off, the ask reaches the loop unpinned, exactly as it does today.
    delete process.env.ENGINE_GUESS_PIN;
    await readSSE(await POST(makeChatRequest({ ask, platform: "tiktok" })));

    process.env.ENGINE_GUESS_PIN = "true";
    await readSSE(await POST(makeChatRequest({ ask, platform: "tiktok" })));
    // …and the one measured false positive stays unpinned even with the flag on: it names the SIM
    // as the action, and pinning hooks would force a wrong BILLED run on an ask that works today.
    await readSSE(
      await POST(
        makeChatRequest({
          ask: "Yes, run the simulate tool on that hook — I want the reaction card.",
          platform: "tiktok",
        }),
      ),
    );

    const calls = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls as Array<[{ forceSkill?: string }]>;
    expect(calls[0]![0].forceSkill, "flag OFF must change nothing").toBeUndefined();
    expect(calls[1]![0].forceSkill, "flag ON pins the guessed generator").toBe("hooks");
    expect(calls[2]![0].forceSkill, "the narrowing must survive the wire").toBeUndefined();
    delete process.env.ENGINE_GUESS_PIN;
  });

  it("Test 6g2: the predispatch LABEL inherits the same narrowing the pin has", async () => {
    // Stage B's B3 frame labels the 4–5s dead zone from the pre-router's guess. It read the guess
    // RAW (`guessSkill`) while the pin one screen below reads it NARROWED (`detectGuessPin`), so the
    // single ask this lane has measured as a harmful guess — the one Test 6g above proves must never
    // be PINNED — was still being ANNOUNCED to the creator as a hooks run, for the whole length of
    // the wait the frame exists to fill. `certain:false` softens the claim; it does not make a wrong
    // one useful, and "Looks like a hooks run…" is worse than the default "Thinking…" on an ask that
    // asked for the SIM.
    //
    // This is B3 alone — no other flag has to be on for a creator to see it.
    //
    // ⚠️ The client half of B3 is well covered (`use-chat-stream.test.ts`), but every one of those
    // tests SUPPLIES the frame as a fixture. Nothing asserted which skill the server picks, which is
    // why a raw-guess read sat here unseen.
    process.env.CHAT_AGENT_DISPATCH = "true";
    process.env.NEXT_PUBLIC_ENGINE_ONE_BRAIN = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      },
    );
    const { POST } = await import("@/app/api/tools/chat/route");

    // THE CONTROL — an ordinary generation ask must still get its label, or the fix is just a delete.
    const labelled = await readSSE(
      await POST(makeChatRequest({ ask: "give me 5 hooks for my student budgeting app", platform: "tiktok" })),
    );
    expect(labelled, "an ordinary ask must still be labelled").toContain("predispatch");
    expect(labelled).toContain('"skill":"hooks"');

    // THE DEFECT — the same sentence Test 6g pins nothing for must be announced as nothing either.
    const falseAlarm = await readSSE(
      await POST(
        makeChatRequest({
          ask: "Yes, run the simulate tool on that hook — I want the reaction card.",
          platform: "tiktok",
        }),
      ),
    );
    expect(falseAlarm, "the measured false positive must not be announced as a hooks run").not.toContain(
      '"skill":"hooks"',
    );

    delete process.env.NEXT_PUBLIC_ENGINE_ONE_BRAIN;
  });

  it("Test 6h: the guess pin never overrides a tapped chip, and never fires for a sealed visitor", async () => {
    // A chip DECLARES its generator, so it must win over any guess — and a sealed /go visitor binds
    // no generators at all, so a pin would name a tool the loop cannot call.
    process.env.CHAT_AGENT_DISPATCH = "true";
    process.env.ENGINE_GUESS_PIN = "true";
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );
    const { POST } = await import("@/app/api/tools/chat/route");

    // The chip says `script`; the guess would say `hooks`. The chip wins.
    await primeDispatchHarness();
    await readSSE(
      await POST(makeChatRequest({ ask: "give me 5 hooks for my budgeting app", platform: "tiktok", skill: "script" })),
    );

    await primeDispatchHarness("user-anon", "thread-anon", true);
    await readSSE(await POST(makeChatRequest({ ask: "give me 5 hooks for my budgeting app", platform: "tiktok" })));

    const calls = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls as Array<[{ forceSkill?: string }]>;
    expect(calls[0]![0].forceSkill, "a declared chip outranks the guess").toBe("script");
    expect(calls[1]![0].forceSkill, "a sealed visitor binds no generators to pin").toBeUndefined();
    delete process.env.ENGINE_GUESS_PIN;
  });

  it("Test 6i: ENGINE_COUNT_HINT reaches the BUNDLE only — the creator's words are untouched", async () => {
    // Measured over 32 unpinned runs on both failing subject shapes: a count in the ask takes
    // dispatch 2/12 → 16/20 and PUSHBACKS 9 → 0. It forces nothing, so unlike the pin it carries no
    // wrong-run exposure. What this pins is the boundary that makes it honest: the count may only
    // ever change what the MODEL reads. `currentAsk` feeds the conversation digest and is the
    // creator's real message — if the hint leaks into it, the app has started quoting words the
    // creator never typed back at them.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );
    const { assembleBundle } = await import("@/lib/kc/assembler");
    const { POST } = await import("@/app/api/tools/chat/route");
    const ask = "give me hooks for my student budgeting app";

    // CONTROL FIRST — the kill switch, the bundle carries the creator's words verbatim.
    process.env.ENGINE_COUNT_HINT = "false";
    await readSSE(await POST(makeChatRequest({ ask, platform: "tiktok" })));

    // Then the SHIPPED default. Deleting the var is the treatment arm now, not the control — the
    // hint is default-ON since 2026-08-12, so an unset environment is production.
    delete process.env.ENGINE_COUNT_HINT;
    await readSSE(await POST(makeChatRequest({ ask, platform: "tiktok" })));

    const bundleCalls = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls as Array<[{ ask: string }]>;
    expect(bundleCalls[0]![0].ask, "the kill switch must change nothing").toBe(ask);
    expect(bundleCalls[1]![0].ask, "the shipped default gives the model the count").toBe(
      "give me 5 hooks for my student budgeting app",
    );

    const loopCalls = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls as Array<[{ currentAsk?: string }]>;
    expect(loopCalls[1]![0].currentAsk, "the creator's own words must never carry the hint").toBe(ask);
    delete process.env.ENGINE_COUNT_HINT;
  });

  it("Test 7: agent loop pure chat (no skill) → streams the answer directly, NO runChatPipeline fallback, plain markdown", async () => {
    process.env.CHAT_AGENT_DISPATCH = "true";
    const { threadId } = await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");
    const { insertMessage } = await import("@/lib/threads/messages");

    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(async (input: { onToken: (d: string) => void }) => {
      input.onToken("grounded answer");
      return { text: "grounded answer", skillRuns: [], uiBlocks: [], toolCalls: [] };
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "what actually makes a good hook?", platform: "tiktok" }));
    expect(res.status).toBe(200);
    const raw = await readSSE(res);

    // The loop handles pure chat too — the old runChatPipeline fallback is GONE (no double-answer).
    expect(runChatAgentStream).toHaveBeenCalledTimes(1);
    expect(runChatPipeline).not.toHaveBeenCalled();
    expect(raw).not.toContain("event: block");
    expect(raw).toContain("event: token");
    expect(raw).toContain("event: done");

    // A pure-chat turn persists PLAIN markdown (no origin marker) → byte-identical reload to shipped chat.
    const calls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls as Array<[string, string, unknown[], string?]>;
    const md = calls
      .filter(([tid, role]) => tid === threadId && role === "assistant")
      .find(([, , blocks]) => (blocks[0] as { type?: string })?.type === "markdown");
    expect(md).toBeDefined();
    expect((md![2][0] as { props: { origin?: string } }).props.origin).toBeUndefined();
  });

  it("Test 8: dispatch flag OFF → the agent loop never runs (byte-identical to shipped chat)", async () => {
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");
    (runChatPipeline as ReturnType<typeof vi.fn>).mockImplementation(async (_input: unknown, onToken: (d: string) => void) => {
      onToken("answer");
      return { fullContent: "answer", coldStart: false };
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "what should I post?", platform: "tiktok" }));
    expect(res.status).toBe(200);
    await readSSE(res);

    expect(runChatAgentStream).not.toHaveBeenCalled();
    expect(runChatPipeline).toHaveBeenCalledTimes(1);
  });

  it("Test 8b: dispatch flag UNSET → defaults ON (agent loop runs, no runChatPipeline)", async () => {
    delete process.env.CHAT_AGENT_DISPATCH; // prod default is now ON
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(async (input: { onToken: (d: string) => void }) => {
      input.onToken("grounded answer");
      return { text: "grounded answer", skillRuns: [], uiBlocks: [], toolCalls: [] };
    });

    const { POST } = await import("@/app/api/tools/chat/route");
    const res = await POST(makeChatRequest({ ask: "what should I post?", platform: "tiktok" }));
    expect(res.status).toBe(200);
    await readSSE(res);

    expect(runChatAgentStream).toHaveBeenCalledTimes(1);
    expect(runChatPipeline).not.toHaveBeenCalled();
  });

  it("Test 8c: COMPOSED_CARDS UNSET → defaults ON; only \"false\" kills it", async () => {
    // Owner ruling 2026-08-14. This flag shipped default-OFF on the stated grounds that "the
    // contract has not been measured against a live model yet"; it has been, on a prod build with
    // ISOLATED threads (n=36): 9/36 before the comparison hint, 22/36 after.
    //
    // What this test exists to catch is the kill switch, not the default. `=== "true"` and
    // `!== "false"` agree on every environment that sets the variable at all — they differ ONLY on
    // an unset one, which is production. So an assertion that sets the var can never see this
    // change, and the arm that matters is the deleted one.
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
    (runChatAgentStream as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onToken: (d: string) => void }) => {
        input.onToken("ok");
        return { text: "ok", skillRuns: [], uiBlocks: [], toolCalls: [] };
      }
    );
    const { POST } = await import("@/app/api/tools/chat/route");

    // The SHIPPED default — an unset variable is what production runs.
    delete process.env.COMPOSED_CARDS;
    await readSSE(await POST(makeChatRequest({ ask: "what should I post?", platform: "tiktok" })));

    // The kill switch, and the ONLY string that may disable it.
    process.env.COMPOSED_CARDS = "false";
    await readSSE(await POST(makeChatRequest({ ask: "what should I post?", platform: "tiktok" })));

    // A half-set environment must stay ON, not fall back to prose.
    process.env.COMPOSED_CARDS = "";
    await readSSE(await POST(makeChatRequest({ ask: "what should I post?", platform: "tiktok" })));

    const calls = (runChatAgentStream as ReturnType<typeof vi.fn>).mock.calls as Array<[{ composedCards?: boolean }]>;
    expect(calls[0]![0].composedCards, "unset is production, and production is ON").toBe(true);
    expect(calls[1]![0].composedCards, 'only the literal "false" kills it').toBe(false);
    expect(calls[2]![0].composedCards, "a half-set env must not silently revert to prose").toBe(true);
    delete process.env.COMPOSED_CARDS;
  });

  it("Test 9: dispatch ON but persona/meet mode → agent loop SKIPPED, persona answer path runs", async () => {
    process.env.CHAT_AGENT_DISPATCH = "true";
    await primeDispatchHarness();
    const { runChatAgentStream } = await import("@/lib/tools/chat-agent-loop");
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

    // Persona chat never orchestrates skills — the agent loop is bypassed entirely.
    expect(runChatAgentStream).not.toHaveBeenCalled();
    expect(runChatPipeline).toHaveBeenCalledTimes(1);
  });
});
