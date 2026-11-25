import { describe, expect, it } from "vitest";
import { threadAudienceOf } from "@/lib/thread-next/thread-audience";
import { hook, md, runHeader } from "@/components/thread-next/__tests__/fixtures/answers";

describe("threadAudienceOf", () => {
  it("last run header wins; General is hidden", () => {
    expect(threadAudienceOf([{ blocks: [runHeader("hooks", "@nia.tests")] }, { blocks: [runHeader("script", "General")] }])).toBeNull();
  });
  it("reads the run header's audience", () => {
    expect(threadAudienceOf([{ blocks: [runHeader("hooks", "@nia.tests")] }])).toBe("@nia.tests");
  });
  it("falls back to the live label when no run header exists", () => {
    expect(threadAudienceOf([], "@nia.tests")).toBe("@nia.tests");
    expect(threadAudienceOf([{ blocks: [md("Hello.")] }], "@dij.arc")).toBe("@dij.arc");
  });
  it("a persisted run header wins over the live label", () => {
    expect(threadAudienceOf([{ blocks: [runHeader("hooks", "@nia.tests"), hook("A")] }], "@dij.arc")).toBe("@nia.tests");
  });
  it("the last header across turns, not the first", () => {
    const turns = [
      { blocks: [runHeader("hooks", "@dij.arc"), hook("A")] },
      { blocks: [md("A chat answer.")] },
      { blocks: [runHeader("script", "@nia.tests")] },
    ];
    expect(threadAudienceOf(turns)).toBe("@nia.tests");
  });
  it("a last header without a label hides the line (it does not reach back)", () => {
    expect(threadAudienceOf([{ blocks: [runHeader("hooks", "@nia.tests")] }, { blocks: [runHeader("script")] }], "@dij.arc")).toBeNull();
  });
  it.each([undefined, null, "", "   ", "General", "general", "your audience", "Your audience"])("hides %j", (label) => {
    expect(threadAudienceOf([], label)).toBeNull();
    if (typeof label === "string") expect(threadAudienceOf([{ blocks: [runHeader("hooks", label)] }])).toBeNull();
  });
  it("trims the label", () => {
    expect(threadAudienceOf([{ blocks: [runHeader("hooks", "  @nia.tests ")] }])).toBe("@nia.tests");
  });
  it("ignores malformed blocks", () => {
    expect(threadAudienceOf([{ blocks: [null, { type: "run-header" }, { type: "run-header", props: { audienceLabel: 3 } }] }], "@nia.tests")).toBe("@nia.tests");
  });
});
