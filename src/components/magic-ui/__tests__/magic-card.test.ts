import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Wave 0 invariant: Magic Card source MUST be installed at
 * src/components/magic-ui/magic-card.tsx AND tuned to coral defaults
 * per UI-SPEC §Magic Card tuning table (D-05).
 *
 * Status before Plan 02: RED (file does not exist).
 * Status after  Plan 02: GREEN (file exists, contains tuned coral defaults).
 */

const SOURCE_PATH = resolve(__dirname, "..", "magic-card.tsx");

describe("Magic Card — tuning invariants (Wave 0 lock)", () => {
  it("source file exists at src/components/magic-ui/magic-card.tsx", () => {
    expect(existsSync(SOURCE_PATH)).toBe(true);
  });

  it("ships with 'use client' directive (interactive primitive)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    expect(src).toMatch(/^"use client"|^'use client'/m);
  });

  it("default gradientFrom is tuned to coral (#FF7F50) — NOT stock violet (#9E7AFF)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    // Pass: coral hex literal appears as a default
    expect(src).toContain("#FF7F50");
    // Fail-fast: stock violet must NOT remain
    expect(src).not.toContain("#9E7AFF");
  });

  it("default gradientTo does NOT contain stock pink (#FE8BBB)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    expect(src).not.toContain("#FE8BBB");
  });

  it("preserves next-themes mounted-state hydration guard (do not strip during tuning)", () => {
    const src = readFileSync(SOURCE_PATH, "utf-8");
    // The mounted-state guard prevents hydration mismatch per RESEARCH §Pitfall 1
    expect(src).toMatch(/useState\(false\)/);
    expect(src).toMatch(/setMounted\(true\)/);
  });
});
