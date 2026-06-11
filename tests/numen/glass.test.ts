/** @vitest-environment happy-dom */
/**
 * tests/numen/glass.test.ts — DS-05 glass primitive gate.
 *
 * The Glass primitive MUST apply `backdropFilter` via a React inline `style`
 * (with `WebkitBackdropFilter` for Safari/iOS) and MUST NOT use a Tailwind
 * `backdrop-blur-*` utility class — Lightning CSS strips the class form in prod
 * (CLAUDE.md known issue, D-05).
 *
 * RED until Plan 02 ships `@/components/numen/glass`. Scaffold — downstream
 * plan turns it GREEN.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";

describe("Glass primitive — inline backdrop-filter (DS-05)", () => {
  it("renders backdropFilter as an inline style matching blur(Npx)", async () => {
    const { Glass } = await import("@/components/numen/glass");
    const { container } = render(createElement(Glass, null, "glassy"));
    const el = container.firstElementChild as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.backdropFilter).toMatch(/blur\(\d+px\)/);
  });

  it("sets WebkitBackdropFilter for Safari/iOS PWA", async () => {
    const { Glass } = await import("@/components/numen/glass");
    const { container } = render(createElement(Glass, null, "glassy"));
    const el = container.firstElementChild as HTMLElement;
    // happy-dom exposes the webkit-prefixed property via style cssText / camelCase
    const webkit =
      (el.style as unknown as Record<string, string>).WebkitBackdropFilter ??
      el.style.getPropertyValue("-webkit-backdrop-filter");
    expect(webkit).toMatch(/blur\(\d+px\)/);
  });

  it("carries NO backdrop-blur utility class (Lightning CSS strips it)", async () => {
    const { Glass } = await import("@/components/numen/glass");
    const { container } = render(createElement(Glass, null, "glassy"));
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).not.toMatch(/backdrop-blur/);
  });
});
