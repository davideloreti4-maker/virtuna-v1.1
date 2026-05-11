import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Wave 0 invariant: Shine Border source MUST be installed and tuned
 * per UI-SPEC §Shine Border tuning table. Also asserts @keyframes shine
 * is present in globals.css after Plan 02 (registry injection fallback).
 */

const SOURCE_PATH = resolve(__dirname, "..", "shine-border.tsx");
const GLOBALS_CSS = resolve(__dirname, "..", "..", "..", "app", "globals.css");

describe("Shine Border — tuning invariants (Wave 0 lock)", () => {
  it("source file exists at src/components/magic-ui/shine-border.tsx", () => {
    expect(existsSync(SOURCE_PATH)).toBe(true);
  });

  it("ships with 'use client' directive", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    expect(src).toMatch(/^"use client"|^'use client'/m);
  });

  it("shineColor default contains coral rgba — NOT stock black (#000000)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    expect(src).toMatch(/255\s*,\s*127\s*,\s*80/);
    // The stock default was a black string default
    expect(src).not.toMatch(/shineColor\s*[:=]\s*["']#000000["']/);
    expect(src).not.toMatch(/shineColor\s*[:=]\s*["']black["']/);
  });

  it("shineColor default is array-form (gradient arc, not single color)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    // Loose match — looks for an array literal containing coral rgba
    expect(src).toMatch(/\[\s*["'`][^"'`]*255[^"'`]*127[^"'`]*80[^"'`]*["'`]/);
  });

  it("@keyframes shine is registered in src/app/globals.css (RESEARCH §Pitfall 6)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8");
    expect(css).toMatch(/@keyframes\s+shine\s*\{/);
  });
});
