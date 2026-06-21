/**
 * Tests for flash-schema.ts — FlashResultSchema (10 personas) + coerceFlashResponse.
 *
 * TDD RED phase: these tests are written against the spec (01-03-PLAN.md Task 1 <behavior>)
 * before flash-schema.ts exists.
 */
import { describe, it, expect } from "vitest";
import { FlashResultSchema, coerceFlashResponse } from "../flash-schema";

// Helper: build a valid persona entry
function makePersona(archetype: string, verdict: "stop" | "scroll" = "stop", quote = "This is a test quote.") {
  return { archetype, verdict, quote };
}

// Helper: build exactly 10 valid personas
function make10Personas() {
  return [
    makePersona("high_engager", "stop",   "I always stop for bold opening hooks."),
    makePersona("saver",        "scroll", "No actionable step? I'm out."),
    makePersona("lurker",       "stop",   "Calm narration, I'll watch the whole thing."),
    makePersona("sharer",       "stop",   "I'm sending this to three people right now."),
    makePersona("tough_crowd",  "scroll", "The hook was weak, see ya."),
    makePersona("purposeful_viewer", "stop", "Clear utility right away, I'm in."),
    makePersona("niche_deep_buyer",  "stop", "This is exactly the solution I needed."),
    makePersona("niche_deep_scout",  "scroll", "Seen this take 100 times, scrolling."),
    makePersona("loyalist",     "stop",   "It's them, I'm watching regardless."),
    makePersona("cross_niche_curiosity", "scroll", "Not for my niche, moving on."),
  ];
}

describe("FlashResultSchema", () => {
  it("accepts exactly 10 valid personas", () => {
    const result = FlashResultSchema.safeParse({ personas: make10Personas() });
    expect(result.success).toBe(true);
  });

  it("rejects 9 personas", () => {
    const personas = make10Personas().slice(0, 9);
    const result = FlashResultSchema.safeParse({ personas });
    expect(result.success).toBe(false);
  });

  it("rejects 11 personas", () => {
    const personas = [...make10Personas(), makePersona("extra", "stop", "extra persona")];
    const result = FlashResultSchema.safeParse({ personas });
    expect(result.success).toBe(false);
  });

  it("rejects empty persona list", () => {
    const result = FlashResultSchema.safeParse({ personas: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a verdict that is not stop or scroll", () => {
    const personas = make10Personas();
    // @ts-expect-error intentionally wrong value
    personas[0] = makePersona("high_engager", "maybe", "Some quote.");
    const result = FlashResultSchema.safeParse({ personas });
    expect(result.success).toBe(false);
  });

  it("rejects a quote that is empty string", () => {
    const personas = make10Personas();
    personas[0] = { ...personas[0], quote: "" };
    const result = FlashResultSchema.safeParse({ personas });
    expect(result.success).toBe(false);
  });

  it("rejects a quote longer than 160 characters", () => {
    const personas = make10Personas();
    personas[0] = { ...personas[0], quote: "x".repeat(161) };
    const result = FlashResultSchema.safeParse({ personas });
    expect(result.success).toBe(false);
  });

  it("accepts a quote that is exactly 160 characters", () => {
    const personas = make10Personas();
    personas[0] = { ...personas[0], quote: "x".repeat(160) };
    const result = FlashResultSchema.safeParse({ personas });
    expect(result.success).toBe(true);
  });

  it("rejects missing verdict field", () => {
    const personas = make10Personas() as object[];
    personas[0] = { archetype: "high_engager", quote: "A quote" };
    const result = FlashResultSchema.safeParse({ personas });
    expect(result.success).toBe(false);
  });
});

describe("coerceFlashResponse", () => {
  it("returns valid shape as-is (no-op on clean output)", () => {
    const input = { personas: make10Personas() };
    const coerced = coerceFlashResponse(input);
    const result = FlashResultSchema.safeParse(coerced);
    expect(result.success).toBe(true);
  });

  it("salvages a bare array (missing personas wrapper)", () => {
    const bare = make10Personas();
    const coerced = coerceFlashResponse(bare);
    const result = FlashResultSchema.safeParse(coerced);
    expect(result.success).toBe(true);
  });

  it("normalizes verdict casing — 'Stop' → 'stop'", () => {
    const personas = make10Personas().map((p) => ({
      ...p,
      verdict: (p.verdict === "stop" ? "Stop" : "Scroll") as string,
    }));
    const coerced = coerceFlashResponse({ personas }) as { personas: typeof personas };
    // After coercion every verdict must be lowercase
    for (const p of coerced.personas) {
      expect(p.verdict).toMatch(/^(stop|scroll)$/);
    }
  });

  it("normalizes verdict casing — 'SCROLL' → 'scroll'", () => {
    const personas = make10Personas().map((p) => ({
      ...p,
      verdict: (p.verdict === "scroll" ? "SCROLL" : "STOP") as string,
    }));
    const coerced = coerceFlashResponse({ personas }) as { personas: typeof personas };
    for (const p of coerced.personas) {
      expect(p.verdict).toMatch(/^(stop|scroll)$/);
    }
  });

  it("strips fenced JSON wrapper and returns inner object", () => {
    // Pass a raw string with fences — coerce should handle JSON-string input
    const inner = JSON.stringify({ personas: make10Personas() });
    const fenced = `\`\`\`json\n${inner}\n\`\`\``;
    // coerce accepts unknown — pass a fenced string (model sometimes wraps in fences)
    const coerced = coerceFlashResponse(fenced);
    const result = FlashResultSchema.safeParse(coerced);
    expect(result.success).toBe(true);
  });

  it("returns object with personas array even on null input", () => {
    const coerced = coerceFlashResponse(null) as { personas: unknown[] };
    expect(coerced).toHaveProperty("personas");
    expect(Array.isArray(coerced.personas)).toBe(true);
  });
});
