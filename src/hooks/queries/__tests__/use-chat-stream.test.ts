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
