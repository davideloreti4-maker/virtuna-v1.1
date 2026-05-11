import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Wave 0 invariant: src/app/(marketing)/page.tsx renders an empty
 * <main> with no imports from @/components/landing (AS-plagiarized).
 *
 * Status before Plan 03: RED — current page.tsx imports 7 AS sections.
 * Status after  Plan 03: GREEN — empty <main> with phase stub comments.
 *
 * Also asserts: marketing layout metadata title is "Virtuna" not
 * "Artificial Societies"; pricing page no longer imports FAQSection
 * from landing; src/components/landing/ directory is deleted.
 */

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const HOME_PAGE = resolve(ROOT, "src", "app", "(marketing)", "page.tsx");
const LAYOUT = resolve(ROOT, "src", "app", "(marketing)", "layout.tsx");
const PRICING_PAGE = resolve(ROOT, "src", "app", "(marketing)", "pricing", "page.tsx");
const LANDING_DIR = resolve(ROOT, "src", "components", "landing");

describe("Marketing shell — Phase 1 cleanup invariants (Wave 0 lock)", () => {
  it("src/app/(marketing)/page.tsx has NO import from @/components/landing", () => {
    const src = readFileSync(HOME_PAGE, "utf-8");
    expect(src).not.toMatch(/from\s+["']@\/components\/landing["']/);
  });

  it("src/app/(marketing)/page.tsx renders <main> with min-h-screen + bg-background", () => {
    const src = readFileSync(HOME_PAGE, "utf-8");
    expect(src).toMatch(/<main\b/);
    expect(src).toContain("min-h-screen");
    expect(src).toContain("bg-background");
  });

  it("src/app/(marketing)/page.tsx contains no AS-plagiarized section names", () => {
    const src = readFileSync(HOME_PAGE, "utf-8");
    // These are the AS-plagiarized section component names
    expect(src).not.toContain("HeroSection");
    expect(src).not.toContain("BackersSection");
    expect(src).not.toContain("FeaturesSection");
    expect(src).not.toContain("StatsSection");
    expect(src).not.toContain("CaseStudySection");
    expect(src).not.toContain("PartnershipSection");
    expect(src).not.toContain("FAQSection");
  });

  it("marketing layout metadata title is 'Virtuna' (not 'Artificial Societies')", () => {
    const src = readFileSync(LAYOUT, "utf-8");
    expect(src).not.toMatch(/title:\s*["']Artificial Societies/);
    expect(src).toMatch(/title:\s*["']Virtuna["']/);
  });

  it("pricing page no longer imports FAQSection from @/components/landing", () => {
    const src = readFileSync(PRICING_PAGE, "utf-8");
    expect(src).not.toMatch(/from\s+["']@\/components\/landing["']/);
  });

  it("src/components/landing/ directory has been deleted", () => {
    expect(existsSync(LANDING_DIR)).toBe(false);
  });
});
