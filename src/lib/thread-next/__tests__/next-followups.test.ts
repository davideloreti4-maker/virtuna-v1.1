import { describe, expect, it } from "vitest";
import { nextFollowups } from "@/lib/thread-next/next-followups";
import { followupsForKind, type ChatTurnKind } from "@/lib/tools/chat-followups";

describe("nextFollowups", () => {
  it("hooks: More hooks, Punch them up (carrying the cards)", () => {
    expect(nextFollowups("hooks").map((f) => f.label)).toEqual(["More hooks", "Punch them up"]);
    expect(nextFollowups("hooks")[1]?.carryCards).toBe(true);
  });

  it.each<[ChatTurnKind, string[]]>([
    ["hooks", ["More hooks", "Punch them up"]],
    ["ideas", ["More ideas", "Sharper angles"]],
    ["script", ["Make it punchier", "Different angle"]],
    ["remix", ["More like this", "Write hooks"]],
    ["test", ["Rewrite the hook", "Fix the pacing"]],
    ["chat", ["Give me ideas", "Write hooks"]],
  ])("%s picks the drawn two", (kind, labels) => {
    expect(nextFollowups(kind).map((f) => f.label)).toEqual(labels);
  });

  it.each<ChatTurnKind>(["explore", "account", "predict", "profile", "read"])("%s takes its first two", (kind) => {
    expect(nextFollowups(kind)).toEqual(followupsForKind(kind).slice(0, 2));
  });

  it("returns the curated objects themselves (prompt, skill, carryCards intact)", () => {
    const curated = followupsForKind("ideas");
    const picked = nextFollowups("ideas");
    expect(picked[0]).toBe(curated.find((f) => f.label === "More ideas"));
    expect(picked[1]).toBe(curated.find((f) => f.label === "Sharper angles"));
    expect(picked[1]).toMatchObject({ skill: "ideas", carryCards: true });
    expect(picked[1]?.prompt.length).toBeGreaterThan(0);
  });
});
