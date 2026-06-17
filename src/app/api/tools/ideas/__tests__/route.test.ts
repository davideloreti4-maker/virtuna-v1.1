/**
 * route.test.ts — Ideas pipeline tests (runner + route).
 *
 * Task 1 (runner tests, tagged "runner"):
 *   - over-generate → gate → ≤3 idea-card blocks
 *   - lead-quote-on-face invariant (D-04/WARNING-4)
 *   - cold-start behavior (null profile)
 *   - sub-floor (Weak) cards dropped, no regen
 *   - seedHookPath returned ("structured")
 *
 * Task 2 (route tests, tagged "route"):
 *   - 401 unauthenticated
 *   - 400 over-cap ask (server-side, WARNING-5)
 *   - over-generate → gate → 3 persisted cards with KC_GEN_VERSION stamp
 *   - lead quote on content frame (D-04/WARNING-4)
 *   - /develop endpoint appends in-thread Hooks placeholder
 *
 * Task 2 (route integration tests):
 *   - 401 unauthenticated
 *   - 400 over-cap ask (server-side validation, WARNING-5)
 *   - over-generate → gate → ≤3 cards persisted with KC_GEN_VERSION stamp
 *   - lead quote present on content frame
 *   - /develop endpoint appends in-thread Hooks placeholder
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IdeaCardBlock } from "@/lib/tools/blocks";

// ─── Mock Qwen client ─────────────────────────────────────────────────────────

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

// ─── Mock runFlashTextMode ────────────────────────────────────────────────────

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled bundle"),
}));

// ─── Mock buildGroundingLine ──────────────────────────────────────────────────

vi.mock("@/lib/kc/grounding-line", () => ({
  buildGroundingLine: vi.fn(() => ({
    line: "Because: fitness · 18-25",
    coldStart: false,
  })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10 personas: 6 stop → Mixed band */
function makePersonasMixed() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 6 ? "stop" : "scroll",
    quote: `Quote from persona ${i}`,
  }));
}

/** 10 personas: 2 stop → Weak band (sub-floor) */
function makePersonasWeak() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 2 ? "stop" : "scroll",
    quote: `Weak persona quote ${i}`,
  }));
}

/** 10 personas: 8 stop → Strong band */
function makePersonasStrong() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 8 ? "stop" : "scroll",
    quote: `Strong persona quote ${i}`,
  }));
}

/** Structured JSON generation response with 5 ideas */
function makeStructuredIdeaResponse(count = 5) {
  return {
    ideas: Array.from({ length: count }, (_, i) => ({
      title: `Idea ${i + 1}`,
      angle: `Angle for idea ${i + 1}`,
      mechanism: `Mechanism ${i + 1}`,
      seedHook: `Seed hook for idea ${i + 1}`,
      needsTake: i % 2 === 0,
      topic: `Topic ${i + 1}`,
      take: `Take ${i + 1}`,
      format: i % 3 === 0 ? null : `Format ${i + 1}`,
    })),
  };
}

// ─── Runner tests (Task 1) ────────────────────────────────────────────────────

describe("runIdeasPipeline (runner)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("over-generates ~5 concepts, SIMs in parallel, returns ≤3 cards above gate floor", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // Qwen generate: 5 ideas structured
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // Flash SIM: all Mixed (3 stops above gate floor)
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Give me fitness ideas",
      platform: "tiktok",
      profileRow: {
        niche_primary: "fitness",
        niche_sub: null,
        target_audience: { age_range: "18-25", gender_skew: null, geo: null, language: null },
        primary_goal: null,
        past_wins: null,
        past_flops: null,
        target_platforms: ["tiktok"],
        user_id: "user-123",
      },
    });

    expect(result.blocks.length).toBeLessThanOrEqual(3);
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.seedHookPath).toBe("structured");
    // All blocks are idea-card type
    for (const block of result.blocks) {
      expect(block.type).toBe("idea-card");
    }
  });

  it("D-04 LEAD-QUOTE INVARIANT: every returned idea-card has scrollQuote populated on the block", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas for fitness",
      platform: "tiktok",
      profileRow: {
        niche_primary: "fitness",
        niche_sub: null,
        target_audience: null,
        primary_goal: null,
        past_wins: null,
        past_flops: null,
        target_platforms: ["tiktok"],
        user_id: "user-123",
      },
    });

    for (const block of result.blocks) {
      const card = block as IdeaCardBlock;
      // scrollQuote must be a non-empty string on every card (face invariant)
      expect(typeof card.props.scrollQuote).toBe("string");
      expect(card.props.scrollQuote.length).toBeGreaterThan(0);
    }
  });

  it("drops Weak-band candidates (sub-floor) and returns survivors only (no regen)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // 5 ideas generated
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // All ideas are Weak band (sub-floor) → all should be dropped
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasWeak() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    // All dropped → 0 blocks (no regen loop — D-03)
    expect(result.blocks.length).toBe(0);
    // runFlashTextMode called exactly once per idea (5 ideas, no regen)
    expect(runFlashTextMode).toHaveBeenCalledTimes(5);
  });

  it("cold-start (null profile) produces cards with honest baseline grounding line", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { buildGroundingLine } = await import("@/lib/kc/grounding-line");

    // Override buildGroundingLine mock for cold-start
    (buildGroundingLine as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      line: "Based on TikTok baselines — add your profile for tailored ideas",
      coldStart: true,
    });

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    // Still produces cards (cold-start doesn't block)
    expect(result.blocks.length).toBeGreaterThan(0);

    // First card's whyItFits should be the honest baseline line
    const firstCard = result.blocks[0] as IdeaCardBlock;
    expect(firstCard.props.whyItFits).toContain("baselines");
  });

  it("caps at 3 survivors even if more than 3 pass the gate", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // 5 ideas, all Strong → all 5 would pass but cap at 3
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(3);
  });

  it("mixed results: returns only survivors (≥3 stops) up to 3 (partial pass)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // 5 ideas; 2 Strong, 3 Weak → 2 survivors
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // Alternate Strong/Weak/Strong/Weak/Weak
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ result: { personas: makePersonasStrong() }, warnings: [] }) // Strong
      .mockResolvedValueOnce({ result: { personas: makePersonasWeak() }, warnings: [] })   // Weak → dropped
      .mockResolvedValueOnce({ result: { personas: makePersonasStrong() }, warnings: [] }) // Strong
      .mockResolvedValueOnce({ result: { personas: makePersonasWeak() }, warnings: [] })   // Weak → dropped
      .mockResolvedValueOnce({ result: { personas: makePersonasWeak() }, warnings: [] });  // Weak → dropped

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(2);
  });

  it("band and fraction are embedded in each card block (D-04)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    for (const block of result.blocks) {
      const card = block as IdeaCardBlock;
      expect(["Strong", "Mixed", "Weak"]).toContain(card.props.band);
      expect(card.props.fraction).toMatch(/\d+\/10 stop/);
      expect(card.props.model).toBe("sim1-flash");
    }
  });
});

// ─── Route tests (Task 2) ─────────────────────────────────────────────────────

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock Supabase service client
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

// Mock insertMessage
vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
}));

// Mock createOpenThreadLazy + threads
vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
  getOpenThread: vi.fn(),
}));

// Mock runIdeasPipeline
vi.mock("@/lib/tools/runners/ideas-runner", () => ({
  runIdeasPipeline: vi.fn(),
}));

// Mock kc-stamp
vi.mock("@/lib/kc/kc-stamp", () => ({
  withKcStamp: vi.fn((obj: Record<string, unknown>) => ({
    ...obj,
    kcGenVersion: "gen.1.0.0",
  })),
  KC_PROVENANCE_FIELD: "kcGenVersion",
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

function makeIdeaCard(i: number): IdeaCardBlock {
  return {
    type: "idea-card",
    props: {
      title: `Idea ${i}`,
      angle: `Angle ${i}`,
      whyItFits: "Because: fitness",
      mechanism: `Mechanism ${i}`,
      seedHook: `Hook ${i}`,
      needsTake: false,
      topic: `Topic ${i}`,
      take: `Take ${i}`,
      format: null,
      band: "Mixed",
      fraction: "6/10 stop",
      scrollQuote: `This stopped me because ${i}`,
      model: "sim1-flash",
    },
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/tools/ideas", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("POST /api/tools/ideas (route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/ideas/route");
    const res = await POST(makeRequest({ ask: "ideas" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ask exceeds MAX_MESSAGE_LENGTH (server-side cap, WARNING-5)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    });

    const { POST } = await import("@/app/api/tools/ideas/route");
    const oversizedAsk = "x".repeat(2001);
    const res = await POST(makeRequest({ ask: oversizedAsk }));
    expect(res.status).toBe(400);
  });

  it("generates 3 idea-card blocks, persists stamped message, streams content-first", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockUser = { id: "user-123" };
    const mockThread = { id: "thread-abc", user_id: "user-123", type: "open", reading_id: null };
    const mockBlocks = [makeIdeaCard(1), makeIdeaCard(2), makeIdeaCard(3)];

    // Supabase server client: auth + creator_profiles
    const mockServiceClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // thin profile
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockServiceClient);

    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runIdeasPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-xyz" });

    const { POST } = await import("@/app/api/tools/ideas/route");
    const res = await POST(makeRequest({ ask: "fitness ideas", platform: "tiktok" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    // Read stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // Must contain a status event
    expect(rawOutput).toContain("event: status");
    // Must contain a content event with card faces + lead quotes
    expect(rawOutput).toContain("event: content");
    // Must contain score events (band chip, one per card)
    expect(rawOutput).toContain("event: score");
    // KC_GEN_VERSION stamp persisted
    expect(insertMessage).toHaveBeenCalledTimes(1);
    const insertArgs = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(insertArgs[0]).toBe("thread-abc"); // threadId
    expect(insertArgs[1]).toBe("assistant");   // role
    // The body includes kcGenVersion stamp wrapper
    const body = insertArgs[2];
    expect(body).toHaveProperty("kcGenVersion");
    expect(body).toHaveProperty("blocks");
    expect((body as { blocks: unknown[] }).blocks).toHaveLength(3);
  });

  it("content event carries lead scrollQuote on the card face (WARNING-4)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockBlocks = [makeIdeaCard(1)];
    const mockThread = { id: "thread-def" };

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runIdeasPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-1" });

    const { POST } = await import("@/app/api/tools/ideas/route");
    const res = await POST(makeRequest({ ask: "ideas", platform: "tiktok" }));
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // Content event must include scrollQuote from the card
    expect(rawOutput).toContain("scrollQuote");
    expect(rawOutput).toContain("This stopped me because 1");
  });
});

describe("POST /api/tools/ideas/develop (chain-anchor route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({ anchor: "Fitness idea text", platform: "tiktok" }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    const res = await DEVELOP(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when anchor exceeds server-side cap (WARNING-5)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }),
      },
    });

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({ anchor: "x".repeat(5001), platform: "tiktok" }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    const res = await DEVELOP(req);
    expect(res.status).toBe(400);
  });

  it("appends Hooks placeholder to open thread and returns thread+message ids", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-hooks" };
    const mockMsg = { id: "msg-hooks" };

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }),
      },
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue(mockMsg);

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({
        anchor: "5 fitness myths busted",
        platform: "tiktok",
        ideaId: "idea-123",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    const res = await DEVELOP(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.threadId).toBe("thread-hooks");
    expect(json.messageId).toBe("msg-hooks");

    // insertMessage called once with a markdown placeholder block
    expect(insertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks] = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(threadId).toBe("thread-hooks");
    expect(role).toBe("assistant");
    expect(Array.isArray(blocks)).toBe(true);
    // Placeholder block contains "hooks" keyword (P4 affordance)
    const blockText = JSON.stringify(blocks);
    expect(blockText.toLowerCase()).toContain("hook");
  });
});
