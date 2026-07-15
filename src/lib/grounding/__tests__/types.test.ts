import { describe, it, expect, vi } from "vitest";
import { parseTeardownTemplate } from "@/lib/grounding/types";

/**
 * Regression guard for the template JSONB parse. The corpus stores two grades of `beats`: a watched
 * extraction carries per-beat timings, a cheap metadata extraction carries only name+description.
 * The schema once required timings to be present-but-nullable, so 14/300 rows silently dropped their
 * ENTIRE template — beats, slots, guidance — over an absent nice-to-have. These lock the contract:
 * beats without timings are valid, and their structural content survives.
 */
describe("parseTeardownTemplate — beats timings are optional", () => {
  const base = {
    name: "Two-tip technical breakdown",
    slots: [],
    skeleton: ["Problem Identification", "Technical Solution #1"],
    guidance: "Use when the topic breaks into a short list of concrete technical tips.",
  };

  it("keeps a template whose beats have NO timing keys (cheap extraction)", () => {
    const t = parseTeardownTemplate({
      ...base,
      beats: [
        { name: "Problem Identification", description: "Address a common frustration." },
        { name: "Technical Solution #1", description: "Show the first fix." },
      ],
    });
    expect(t).not.toBeNull();
    expect(t?.beats).toHaveLength(2);
    expect(t?.beats?.[0].name).toBe("Problem Identification");
    expect(t?.guidance).toContain("technical tips");
  });

  it("keeps timings when a watched extraction did capture them", () => {
    const t = parseTeardownTemplate({
      ...base,
      beats: [{ name: "Hook", description: "Open on the claim.", startSec: 0, endSec: 2 }],
    });
    expect(t?.beats?.[0].startSec).toBe(0);
    expect(t?.beats?.[0].endSec).toBe(2);
  });

  it("still rejects a genuinely malformed template and names the failing path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // `skeleton` must be string[]; a number array is real shape drift, not a missing garnish.
    const t = parseTeardownTemplate({ ...base, skeleton: [1, 2, 3] });
    expect(t).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("skeleton"));
    warn.mockRestore();
  });
});
