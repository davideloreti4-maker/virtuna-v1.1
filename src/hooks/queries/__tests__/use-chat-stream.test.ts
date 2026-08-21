// @vitest-environment happy-dom
/**
 * use-chat-stream.test.ts — the SSE consumer for POST /api/tools/chat.
 *
 * Covers BOTH shapes the route can stream:
 *   1. Plain chat (shipped path): meta → token* → done. streamingText accumulates; the
 *      chat-as-agent state (streamingBlocks / stages) stays empty.
 *   2. Chat-as-agent dispatch (CHAT_AGENT_DISPATCH): meta → stage* → block* → token(closing) →
 *      done. The dispatched skill's card-blocks land in streamingBlocks (arrival order), its
 *      real pipeline phases land in stages, and the co-pilot line lands in streamingText.
 *   3. reset() clears the dispatch state (blocks + stages) between turns.
 *
 * The hook is transport-only — it does not know the CHAT_AGENT_DISPATCH flag; it renders whatever
 * events the route emits. So a plain-chat run (flag off) is byte-identical to before this work.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatStream } from "@/hooks/queries/use-chat-stream";
import { encodeSSE } from "@/test/fixtures/stage-events";

function mockSSEResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const IDEA_CARD = (title: string) => ({
  type: "idea-card",
  props: {
    title,
    angle: "an angle",
    whyItFits: "because",
    mechanism: "curiosity",
    seedHook: `hook for ${title}`,
    needsTake: false,
    topic: "morning routines",
    take: "",
    format: null,
    band: "Strong",
    fraction: "4/5",
    scored: true,
    scrollQuote: "you won't believe",
    model: "sim1-flash",
  },
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useChatStream", () => {
  it("plain chat: meta → token → done accumulates text; dispatch state stays empty", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("meta", { coldStart: false }),
        encodeSSE("token", { delta: "Post " }),
        encodeSSE("token", { delta: "consistently." }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("what should I post?", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.streamingText).toBe("Post consistently.");
    expect(result.current.streamingBlocks).toEqual([]);
    expect(result.current.stages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("dispatch: stage + block events fill streamingBlocks/stages; closing token → streamingText", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("meta", { coldStart: false }),
        encodeSSE("stage", { name: "Generating", status: "active" }),
        encodeSSE("block", { block: IDEA_CARD("Idea A") }),
        encodeSSE("block", { block: IDEA_CARD("Idea B") }),
        encodeSSE("stage", { name: "Generating", status: "done" }),
        encodeSSE("token", { delta: "I made 2 angles — want hooks for one?" }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("give me 3 ideas about morning routines", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    // Cards arrived in order and are the real idea-card blocks the thread renders.
    expect(result.current.streamingBlocks).toHaveLength(2);
    expect((result.current.streamingBlocks[0] as { type: string }).type).toBe("idea-card");
    expect((result.current.streamingBlocks[1] as { props: { title: string } }).props.title).toBe("Idea B");
    // Stage upserted by name (active → done), single entry.
    expect(result.current.stages).toEqual([{ name: "Generating", status: "done" }]);
    // Closing co-pilot line accumulated as text.
    expect(result.current.streamingText).toBe("I made 2 angles — want hooks for one?");
    expect(result.current.error).toBeNull();
  });

  it("dispatch event names the skill BEFORE its stages; a second dispatch starts a fresh spine", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("meta", { coldStart: false }),
        // Run 1: the agent picks ideas.
        encodeSSE("dispatch", { skill: "ideas" }),
        encodeSSE("stage", { name: "Generating", status: "active" }),
        encodeSSE("stage", { name: "Generating", status: "done" }),
        encodeSSE("block", { block: IDEA_CARD("Idea A") }),
        // Run 2 (same turn): the agent follows up with hooks — its dispatch CLEARS run 1's
        // stages so the second spine isn't overlaid on the first run's finished steps.
        encodeSSE("dispatch", { skill: "hooks" }),
        encodeSSE("stage", { name: "Simulating your audience", status: "active" }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("ideas then hooks", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.dispatchedSkill).toBe("hooks");
    // Run 1's "Generating" is GONE — only run 2's live stage remains.
    expect(result.current.stages).toEqual([{ name: "Simulating your audience", status: "active" }]);
    expect(result.current.streamingBlocks).toHaveLength(1);
  });

  it("dispatchedSkill is null on a plain chat turn and cleared by reset()", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("dispatch", { skill: "ideas" }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    expect(result.current.dispatchedSkill).toBeNull();
    await act(async () => {
      await result.current.start("ideas please", "tiktok");
    });
    await waitFor(() => expect(result.current.dispatchedSkill).toBe("ideas"));

    act(() => {
      result.current.reset();
    });
    expect(result.current.dispatchedSkill).toBeNull();
  });

  it("reset() clears dispatched blocks + stages between turns", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("block", { block: IDEA_CARD("Idea A") }),
        encodeSSE("stage", { name: "Generating", status: "done" }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("ideas please", "tiktok");
    });
    await waitFor(() => expect(result.current.streamingBlocks).toHaveLength(1));

    act(() => {
      result.current.reset();
    });
    expect(result.current.streamingBlocks).toEqual([]);
    expect(result.current.stages).toEqual([]);
    expect(result.current.streamingText).toBe("");
  });
});

// ── Stage B (B3): the predispatch frame, and (B1/B2) the riders on the request body ────────────
//
// `predispatch` arrives BEFORE the loop starts, and it is two different claims wearing one event
// name. A chip or card CTA pinned the skill, so round 1 WILL call it — that is knowledge, and it
// seeds the capsule exactly as `dispatch` does. A typed ask only got a keyword guess — that is a
// hint, and it must never reach `dispatchedSkill`, because doing so would draw the full run spine
// for a run that may never start.
describe("useChatStream — predispatch (Stage B)", () => {
  it("certain:true seeds dispatchedSkill — the creator pressed it, so the capsule is honest", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("predispatch", { skill: "hooks", certain: true }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("Give me a few more hook options.", "tiktok", "hooks");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.dispatchedSkill).toBe("hooks");
    expect(result.current.preGuess).toBeNull();
  });

  it("certain:false stays a HINT — it never becomes the dispatched skill", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("predispatch", { skill: "hooks", certain: false }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("write me some hooks", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.preGuess).toBe("hooks");
    expect(result.current.dispatchedSkill).toBeNull();
  });

  it("the real dispatch REPLACES the guess — including when the guess was wrong", async () => {
    // The failure this protects against: the heuristic says hooks, the agent runs ideas, and the
    // thread shows both claims at once.
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("predispatch", { skill: "hooks", certain: false }),
        encodeSSE("dispatch", { skill: "ideas" }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("write me some hooks", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.dispatchedSkill).toBe("ideas");
    expect(result.current.preGuess).toBeNull();
  });

  it("a guess that the agent answers in PROSE simply expires with the turn", async () => {
    // No dispatch ever arrives. The hint stays on the hook, but the turn now has content, so the
    // thinking row it labelled is gone from the UI (see chat-turn.test.tsx). reset() clears it.
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("predispatch", { skill: "script", certain: false }),
        encodeSSE("token", { delta: "What's the video about?" }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("write a script", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.dispatchedSkill).toBeNull();
    act(() => {
      result.current.reset();
    });
    expect(result.current.preGuess).toBeNull();
  });

  it("ignores a predispatch frame with no skill", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([encodeSSE("predispatch", { certain: false }), encodeSSE("done", {})]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("hi", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.preGuess).toBeNull();
    expect(result.current.dispatchedSkill).toBeNull();
  });
});

// ── Phase 5 (Task 2): the refresh channel — `revised` frames → revisedSheets ────────────────────
//
// `revise_remix` (Task 5) is a free tool that rewrites a beat script already sitting in a mounted
// RemixBeats card. The card fetched once on mount and the thread reload never remounts it
// (positional keys), so a revision has to reach it through an explicit signal instead of a
// refetch-on-render. This is that signal, transport-only: the hook just turns each `revised` frame
// into an entry with a per-blueprintId incrementing nonce (the focusVideo lesson — composer.tsx
// nonce pattern — a REPEAT revision of the same sheet must still read as a fresh signal).
describe("useChatStream — revised (phase 5 refresh channel)", () => {
  it("a revised frame yields a revisedSheets entry with nonce 1", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("revised", { blueprintId: "bp1", variant: 1 }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("make it punchier", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.revisedSheets).toEqual([{ blueprintId: "bp1", variant: 1, nonce: 1 }]);
  });

  it("two revisions of the SAME sheet get distinct, incrementing nonces", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("revised", { blueprintId: "bp1", variant: 1 }),
        encodeSSE("revised", { blueprintId: "bp1", variant: 1 }),
        encodeSSE("done", {}),
      ]),
    );

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("punch it up again", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));

    expect(result.current.revisedSheets).toEqual([
      { blueprintId: "bp1", variant: 1, nonce: 1 },
      { blueprintId: "bp1", variant: 1, nonce: 2 },
    ]);
  });

  it("revisedSheets stays empty on a plain chat turn", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([encodeSSE("token", { delta: "hi" }), encodeSSE("done", {})]),
    );
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("hi", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));
    expect(result.current.revisedSheets).toEqual([]);
  });

  it("ignores a revised frame with no blueprintId", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([encodeSSE("revised", { variant: 1 }), encodeSSE("done", {})]),
    );
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("hi", "tiktok");
    });
    await waitFor(() => expect(result.current.isDone).toBe(true));
    expect(result.current.revisedSheets).toEqual([]);
  });

  it("reset() does NOT clear revisedSheets — the signal must survive into the next turn", async () => {
    // Unlike streamingBlocks/stages (this turn's live render), a revision is a durable fact about
    // a card already on screen. Clearing it on the next send would make an unrelated later turn
    // silently drop the counter RemixBeats is reading, exactly the nudgeShown precedent.
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("revised", { blueprintId: "bp1", variant: 1 }),
        encodeSSE("done", {}),
      ]),
    );
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("make it punchier", "tiktok");
    });
    await waitFor(() => expect(result.current.revisedSheets).toHaveLength(1));

    act(() => {
      result.current.reset();
    });
    expect(result.current.revisedSheets).toHaveLength(1);
  });
});

describe("useChatStream — the request body (Stage B riders)", () => {
  /** The JSON the hook actually POSTed. */
  const sentBody = () =>
    JSON.parse((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1].body as string);

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(mockSSEResponse([encodeSSE("done", {})]));
  });

  it("a typed send carries ask + platform ONLY — byte-identical to before Stage B", async () => {
    // THE CONTROL. Every rider is omitted rather than sent as null/undefined, so a dark build's
    // request is indistinguishable from the one that shipped.
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("how often should I post?", "tiktok");
    });
    expect(sentBody()).toEqual({ ask: "how often should I post?", platform: "tiktok" });
  });

  it("carries the anchor a card CTA was pressed on (B1)", async () => {
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("Write the script from this hook.", "tiktok", "script", {
        anchor: "Everyone lied about 5am",
      });
    });
    expect(sentBody()).toEqual({
      ask: "Write the script from this hook.",
      platform: "tiktok",
      skill: "script",
      anchor: "Everyone lied about 5am",
    });
  });

  it("carries the pack a chip is pointing at (B2)", async () => {
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("Rewrite these hooks tighter.", "tiktok", "hooks", {
        cards: ["hook one", "hook two"],
      });
    });
    expect(sentBody().cards).toEqual(["hook one", "hook two"]);
  });

  it("omits an EMPTY pack rather than sending an empty array", async () => {
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("Rewrite these.", "tiktok", "hooks", { cards: [] });
    });
    expect(sentBody()).not.toHaveProperty("cards");
  });
});
