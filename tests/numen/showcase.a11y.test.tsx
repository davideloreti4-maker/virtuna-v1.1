/** @vitest-environment happy-dom */
/**
 * tests/numen/showcase.a11y.test.tsx — Plan 04 axe gate + DS-08 structural guard.
 *
 * Two things this file guards:
 *  (a) the Numen kit showcase render passes axe with no violations, and
 *  (b) the DS-08 keyframe-as-chroma section structure does not silently regress
 *      (a CHEAP, NON-perceptual guard — the perceptual gate stays the Task 3
 *      human checkpoint on the deployed build).
 *
 * next/font/google MUST be mocked NON-CONDITIONALLY: the page imports
 * `Newsreader` (and the app transitively wires Inter / Source Serif 4) from
 * next/font/google, which throws at module load under happy-dom. The mock below
 * returns a stub per named export exposing `className`/`variable`/`style`, so the
 * test reaches the axe assertion instead of failing at import.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";

// REQUIRED, non-conditional. Each named font export the page imports
// (Newsreader here; Inter / Source_Serif_4 transitively) is stubbed to a factory
// returning a font object exposing `className` / `variable` / `style`.
//
// NOTE: this MUST be an explicit object, NOT a catch-all Proxy. A Proxy whose
// `get` trap returns a function for EVERY key also returns one for `then`, which
// makes the mocked module thenable — `await import("next/font/google")` then
// chains on that fake `then` and hangs forever. The explicit map has no `then`.
vi.mock("next/font/google", () => {
  const fontStub = () => ({
    className: "font-stub",
    variable: "--font-stub",
    style: { fontFamily: "stub" },
  });
  return {
    Inter: fontStub,
    Source_Serif_4: fontStub,
    Newsreader: fontStub,
  };
});

import NumenKitPage from "@/app/(kit)/numen-kit/page";

describe("Numen kit showcase a11y", () => {
  it("renders with no axe violations", async () => {
    const { container } = render(<NumenKitPage />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });

  it("DS-08: keyframe still renders adjacent to near-neutral chrome (structural)", () => {
    const { container } = render(<NumenKitPage />);

    // The DS-08 section is queryable via its stable selector.
    const section = container.querySelector(
      '[data-testid="ds08-keyframe-chroma"]',
    );
    expect(section).not.toBeNull();

    // It contains a keyframe still (an <img> with an explicit alt).
    const keyframe = section!.querySelector("img[alt]");
    expect(keyframe).not.toBeNull();
    expect(keyframe!.getAttribute("alt")).toBeTruthy();

    // A near-neutral chrome container (bg-panel + border-border) sits adjacent
    // to the keyframe (same flex row → shares the keyframe's parent).
    const row = keyframe!.parentElement!;
    const chrome = row.querySelector(".bg-panel.border-border");
    expect(chrome).not.toBeNull();

    // The chrome is a SIBLING of the keyframe (adjacent), not the keyframe itself.
    expect(chrome).not.toBe(keyframe);
    expect(chrome!.parentElement).toBe(row);
  });
});
