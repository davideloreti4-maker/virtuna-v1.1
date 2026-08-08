import { describe, it, expect } from "vitest";
import { fractionToStopPct, reactRequestBody, reactResponseToSnapshot } from "../fire-sim";

describe("fractionToStopPct", () => {
  it("parses the engine's honest fraction", () => {
    expect(fractionToStopPct("7/10 stop")).toBe(70);
    expect(fractionToStopPct("3 / 10")).toBe(30);
  });
  it("refuses to seal on a malformed fraction (never fabricates a %)", () => {
    expect(fractionToStopPct("")).toBeNull();
    expect(fractionToStopPct("strong")).toBeNull();
    expect(fractionToStopPct("7/0")).toBeNull();
  });
});

describe("reactRequestBody", () => {
  it("pins and persists a deliberate report run", () => {
    expect(reactRequestBody({ text: "a hook" })).toEqual({ text: "a hook", pin: true, persist: true });
  });
  it("carries the framing when the card kind implies one", () => {
    expect(reactRequestBody({ text: "x", kind: "idea" })).toMatchObject({ framing: "idea" });
    expect(reactRequestBody({ text: "x", kind: "hook" })).toMatchObject({ framing: "hook" });
    expect(reactRequestBody({ text: "x", kind: "remix" })).not.toHaveProperty("framing");
  });
  it("sends NO platform and NO lens — the Flash sim is platform-blind", () => {
    expect(reactRequestBody({ text: "x" })).not.toHaveProperty("platform");
    expect(reactRequestBody({ text: "x" })).not.toHaveProperty("lens");
  });
});

describe("reactResponseToSnapshot", () => {
  it("maps a real response", () => {
    const snap = reactResponseToSnapshot({
      fraction: "8/10 stop",
      personas: [{ archetype: "a", verdict: "stop", quote: "yes" }],
      population: null,
    });
    expect(snap).toEqual({
      stopPct: 80,
      personas: [{ archetype: "a", verdict: "stop", quote: "yes" }],
      population: null,
    });
  });
  it("returns null when the fraction cannot be parsed — the card stays honestly unsimulated", () => {
    expect(reactResponseToSnapshot({ fraction: "??", personas: [] })).toBeNull();
    expect(reactResponseToSnapshot(null)).toBeNull();
  });
});
