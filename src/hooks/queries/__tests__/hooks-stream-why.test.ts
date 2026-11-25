// @vitest-environment happy-dom
/**
 * Maven's pick (spec 2026-11-25-maven-pick-design.md): the live hooks turn draws from `toBlocks()`,
 * which builds each card's props field by field, so a prop parsed off the wire and not copied there
 * is dropped in silence, and the line under a live pack would appear only after the fold. The real
 * hook reads a real SSE body; the one stand-in is the network (`fetch`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useChatStream } from "@/hooks/queries/use-chat-stream";
import { useHooksStream } from "@/hooks/queries/use-hooks-stream";

const REASON = "It dares a friend by name, so you wait to hear why.";

const face = (i: number, extra: Record<string, unknown> = {}) => ({
  type: "hook-card",
  props: {
    hookLine: `Hook line ${i}`,
    audienceArchetype: "",
    mechanism: `Mechanism ${i}`,
    seedHook: `Hook line ${i}`,
    rank: i,
    scrollQuote: "",
    model: "sim1-flash",
    channel: null,
    provenance: "projected",
    ...extra,
  },
});

function sse(frames: Array<[string, unknown]>): Response {
  const body = frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHooksStream: why", () => {
  it("a card's why reaches the live block; a card without one, or with only spaces, has no key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          sse([
            ["content", { blocks: [face(1, { why: REASON }), face(2), face(3, { why: "   " })] }],
            ["done", {}],
          ]),
        ),
      ),
    );
    const { result } = renderHook(() => useHooksStream());
    await act(async () => {
      await result.current.start("hooks", "tiktok");
    });
    await waitFor(() => expect(result.current.toBlocks()).toHaveLength(3));
    const blocks = result.current.toBlocks();
    expect(blocks[0]!.props.why).toBe(REASON);
    expect("why" in blocks[1]!.props).toBe(false);
    expect("why" in blocks[2]!.props).toBe(false);
  });
});

// Fix round 1 (review M1): a refined card is parsed by the refine handler, not `start`'s.
describe("useHooksStream: why on a refined card", () => {
  it("the refined card's why reaches the live block", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(sse([["content", { blocks: [face(1, { why: REASON })] }], ["done", {}]]))));
    const { result } = renderHook(() => useHooksStream());
    await act(async () => {
      await result.current.startRefine({ skill: "hooks", instruction: "punchier", anchor: "hookLine: Hook line 1" });
    });
    await waitFor(() => expect(result.current.toBlocks()).toHaveLength(1));
    expect(result.current.toBlocks()[0]!.props.why).toBe(REASON);
  });
});

// The chat agent's own hooks run: the route sends each card whole (`block`), and the chat stream keeps
// it as it came, so the reason reaches the live turn untouched.
describe("useChatStream: why on a dispatched hook card", () => {
  it("a dispatched hook card keeps its why", async () => {
    const card = face(1, { why: REASON, band: "Strong", fraction: "8/10 stop" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          sse([
            ["meta", { coldStart: false }],
            ["block", { block: card }],
            ["done", {}],
          ]),
        ),
      ),
    );
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start("2 hooks for meal prep", "tiktok");
    });
    await waitFor(() => expect(result.current.streamingBlocks).toHaveLength(1));
    expect((result.current.streamingBlocks[0] as { props: { why?: string } }).props.why).toBe(REASON);
  });
});
