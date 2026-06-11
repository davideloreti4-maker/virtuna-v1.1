/** @vitest-environment happy-dom */
/**
 * tests/numen/primitives.test.ts — DS-05 tailwind-variants primitive gate.
 *
 * The Numen primitives are built with `tailwind-variants` slots (D-08). This
 * scaffold asserts the variant API contract:
 *  - pill-chip exposes slot functions; the `agentic` intent produces a different
 *    class string than `instant` (visually distinct for later TOOL-04).
 *  - icon-button enforces a 44px minimum touch target.
 *  - verdict-swatch exposes a `verdict` variant (good / mixed / bad).
 *  - surface exposes a slot/variant function.
 *
 * RED until Plan 02 ships `@/components/numen/{pill-chip,icon-button,verdict-swatch,surface}`.
 */
import { describe, it, expect } from "vitest";

describe("pill-chip — tailwind-variants slots + intent (DS-05 / D-08)", () => {
  it("exposes slot functions and distinguishes agentic from instant", async () => {
    const mod = await import("@/components/numen/pill-chip");
    const tv = (mod as Record<string, unknown>).pillChip as (
      props?: Record<string, unknown>,
    ) => { root: () => string };
    expect(typeof tv).toBe("function");
    const instant = tv({ intent: "instant" }).root();
    const agentic = tv({ intent: "agentic" }).root();
    expect(instant).not.toBe(agentic);
  });
});

describe("icon-button — 44px minimum touch target (DS-05)", () => {
  it("enforces min-h-[44px] / min-w-[44px]", async () => {
    const mod = await import("@/components/numen/icon-button");
    const tv = (mod as Record<string, unknown>).iconButton as (
      props?: Record<string, unknown>,
    ) => string | { root: () => string };
    expect(typeof tv).toBe("function");
    const result = tv();
    const cls = typeof result === "string" ? result : result.root();
    expect(cls).toMatch(/min-h-\[44px\]/);
    expect(cls).toMatch(/min-w-\[44px\]/);
  });
});

describe("verdict-swatch — three muted verdict variants (DS-02)", () => {
  it("exposes good / mixed / bad as distinct variants", async () => {
    const mod = await import("@/components/numen/verdict-swatch");
    const tv = (mod as Record<string, unknown>).verdictSwatch as (
      props?: Record<string, unknown>,
    ) => string | { root: () => string };
    expect(typeof tv).toBe("function");
    const cls = (v: string) => {
      const r = tv({ verdict: v });
      return typeof r === "string" ? r : r.root();
    };
    expect(cls("good")).not.toBe(cls("mixed"));
    expect(cls("mixed")).not.toBe(cls("bad"));
  });
});

describe("surface — slot/variant function (DS-05)", () => {
  it("exposes a tailwind-variants function", async () => {
    const mod = await import("@/components/numen/surface");
    const tv = (mod as Record<string, unknown>).surface;
    expect(typeof tv).toBe("function");
  });
});
