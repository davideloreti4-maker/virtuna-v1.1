/**
 * rehydrate-thread.test.ts — the pure reload helpers that decide whether a thread renders as one
 * unified chat-agent stream on reload. Locks the invariant that makes the feature regression-safe:
 * ONLY a thread stamped with the server-set origin marker is treated as chat-agent; every existing /
 * selector / flag-off thread is not.
 */

import { describe, it, expect } from "vitest";
import { isChatAgentThread, orderedAssistantBlocks, orderedTurns } from "../rehydrate-thread";

const md = (text: string, origin?: string) => ({ type: "markdown", props: origin ? { text, origin } : { text } });
const idea = (title: string) => ({ type: "idea-card", props: { title } });

describe("isChatAgentThread", () => {
  it("is true when an assistant markdown block carries origin='chat-agent'", () => {
    const messages = [
      { role: "user", blocks: [md("how would this land?")] },
      { role: "assistant", blocks: [idea("The 5am myth")] },
      { role: "assistant", blocks: [md("I've generated 3 ideas.", "chat-agent")] },
    ];
    expect(isChatAgentThread(messages)).toBe(true);
  });

  it("is false for a selector thread — same cards + co-pilot line, but NO marker", () => {
    const messages = [
      { role: "user", blocks: [md("ideas about morning routines")] },
      { role: "assistant", blocks: [idea("The 5am myth")] },
      { role: "assistant", blocks: [md("Here are 3 ideas — want hooks?")] }, // co-pilot line, unmarked
    ];
    expect(isChatAgentThread(messages)).toBe(false);
  });

  it("ignores a USER markdown that happens to carry the marker (only assistant blocks count)", () => {
    const messages = [{ role: "user", blocks: [md("nice", "chat-agent")] }];
    expect(isChatAgentThread(messages)).toBe(false);
  });

  it("is false for an empty thread", () => {
    expect(isChatAgentThread([])).toBe(false);
  });
});

describe("orderedAssistantBlocks", () => {
  it("flattens every non-user block in message order (cards + co-pilot interleaved)", () => {
    const messages = [
      { role: "user", blocks: [md("q")] },
      { role: "assistant", blocks: [idea("A"), idea("B")] },
      { role: "assistant", blocks: [md("closing", "chat-agent")] },
    ];
    const stream = orderedAssistantBlocks(messages);
    expect(stream.map((b) => b.type)).toEqual(["idea-card", "idea-card", "markdown"]);
  });

  it("excludes user turns", () => {
    const messages = [
      { role: "user", blocks: [md("the user ask")] },
      { role: "assistant", blocks: [idea("A")] },
    ];
    expect(orderedAssistantBlocks(messages).every((b) => b.type !== "markdown" || (b.props as { text?: string }).text !== "the user ask")).toBe(true);
    expect(orderedAssistantBlocks(messages)).toHaveLength(1);
  });
});

describe("orderedTurns", () => {
  // The multi-turn reload bug: a 2-turn chat-agent thread must rehydrate as TWO turns, each carrying
  // its own question + only the answer it produced. The old flatten (orderedAssistantBlocks) collapsed
  // this into one stream under the last question — these assertions FAIL against that behaviour.
  it("keeps each question with only the answer it produced", () => {
    const messages = [
      { role: "user", blocks: [md("what makes a good hook?")] },
      { role: "assistant", blocks: [md("A good hook is a specific prediction error.", "chat-agent")] },
      { role: "user", blocks: [md("give me 3 ideas about morning routines")] },
      { role: "assistant", blocks: [idea("The 5am myth"), idea("Coffee last")] },
      { role: "assistant", blocks: [md("Here are 3 ideas — want hooks?", "chat-agent")] },
    ];
    const turns = orderedTurns(messages);

    expect(turns).toHaveLength(2);
    // Turn 1: the hook question owns ONLY the hook explainer.
    expect(turns[0]?.userTurn).toBe("what makes a good hook?");
    expect(turns[0]?.blocks.map((b) => b.type)).toEqual(["markdown"]);
    expect((turns[0]?.blocks[0]?.props as { text?: string }).text).toBe(
      "A good hook is a specific prediction error.",
    );
    // Turn 2: the ideas question owns the cards + closing line (consecutive assistant messages merge).
    expect(turns[1]?.userTurn).toBe("give me 3 ideas about morning routines");
    expect(turns[1]?.blocks.map((b) => b.type)).toEqual(["idea-card", "idea-card", "markdown"]);
    // The hook explainer must NOT leak into the ideas turn (the misattribution the bug produced).
    expect(
      turns[1]?.blocks.some(
        (b) => (b.props as { text?: string }).text === "A good hook is a specific prediction error.",
      ),
    ).toBe(false);
  });

  it("reads the question text from the user message's first markdown block", () => {
    const turns = orderedTurns([
      { role: "user", blocks: [md("only q")] },
      { role: "assistant", blocks: [idea("A")] },
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.userTurn).toBe("only q");
    expect(turns[0]?.blocks).toHaveLength(1);
  });

  it("opens an anonymous turn for a leading assistant block (no question dropped)", () => {
    const turns = orderedTurns([{ role: "assistant", blocks: [idea("greeting")] }]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.userTurn).toBeNull();
    expect(turns[0]?.blocks).toHaveLength(1);
  });

  it("is empty for an empty thread", () => {
    expect(orderedTurns([])).toEqual([]);
  });
});
