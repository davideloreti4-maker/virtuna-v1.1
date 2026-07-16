/**
 * rehydrate-thread.test.ts — the pure reload helpers that decide whether a thread renders as one
 * unified chat-agent stream on reload. Locks the invariant that makes the feature regression-safe:
 * ONLY a thread stamped with the server-set origin marker is treated as chat-agent; every existing /
 * selector / flag-off thread is not.
 */

import { describe, it, expect } from "vitest";
import { isChatAgentThread, orderedAssistantBlocks } from "../rehydrate-thread";

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
