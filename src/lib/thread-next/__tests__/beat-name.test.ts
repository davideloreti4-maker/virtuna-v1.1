import { describe, expect, it } from "vitest";
import { beatName } from "@/lib/thread-next/beat-name";

describe("beatName", () => {
  it.each<[string, string]>([
    ["Hook", "Hook"],
    ["  Setup ", "Setup"],
    ["Payoff", "Payoff"],
    // As sent: only "CTA" is spelled out; any other label keeps its own case.
    ["HOOK", "HOOK"],
    ["Beat 3", "Beat 3"],
  ])("%j reads %j", (label, name) => {
    expect(beatName(label)).toBe(name);
  });

  it.each(["CTA", "cta", "Cta", " CTA  "])("%j reads 'Call to action'", (label) => {
    expect(beatName(label)).toBe("Call to action");
  });

  it("only the whole label: 'CTA card' or 'The CTA' stay as sent", () => {
    expect(beatName("CTA card")).toBe("CTA card");
    expect(beatName("The CTA")).toBe("The CTA");
  });

  it.each(["", "   ", "\n"])("an empty label %j has no name", (label) => {
    expect(beatName(label)).toBeNull();
  });
});
