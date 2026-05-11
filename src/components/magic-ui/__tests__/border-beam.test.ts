import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Wave 0 invariant: Border Beam source MUST be installed and tuned
 * per UI-SPEC §Border Beam tuning table.
 * Status before Plan 02: RED. Status after Plan 02: GREEN.
 */

const SOURCE_PATH = resolve(__dirname, "..", "border-beam.tsx");

describe("Border Beam — tuning invariants (Wave 0 lock)", () => {
  it("source file exists at src/components/magic-ui/border-beam.tsx", () => {
    expect(existsSync(SOURCE_PATH)).toBe(true);
  });

  it("ships with 'use client' directive", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    expect(src).toMatch(/^"use client"|^'use client'/m);
  });

  it("colorFrom default contains coral rgba — NOT stock amber (#ffaa40)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    // Coral rgba signature — UI-SPEC prescribes rgba(255,127,80, ...)
    expect(src).toMatch(/255\s*,\s*127\s*,\s*80/);
    // Fail-fast: stock amber must NOT remain (case-insensitive)
    expect(src.toLowerCase()).not.toContain("#ffaa40");
  });

  it("colorTo default does NOT contain stock violet (#9c40ff)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    expect(src.toLowerCase()).not.toContain("#9c40ff");
  });

  it("imports from motion/react (NOT framer-motion) — RESEARCH §Pitfall 7", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    expect(src).toMatch(/from\s+["']motion\/react["']/);
    expect(src).not.toMatch(/from\s+["']framer-motion["']/);
  });
});
