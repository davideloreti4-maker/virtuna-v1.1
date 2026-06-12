/** @vitest-environment happy-dom */
/**
 * page-headings.test.tsx — Wave-0 Nyquist scaffold for the single-h1 invariant.
 *
 * RED until Plan 03-05 wires the `(marketing)` page (it becomes `async` once it
 * threads `getWaitlistCount()` into the proof surfaces). Encodes the D-10 / UI-SPEC
 * Accessibility-Baseline invariant: after all section slots fill, the page has
 * EXACTLY ONE level-1 heading — the hero h1 — with no heading-level skips.
 *
 * The page is imported dynamically and rendered with `await HomePage()` inside the
 * test (it is an async RSC after Plan 05) so the file is RED on the not-yet-wired
 * async page now.
 *
 * RED-gate: the invariant is "exactly one h1 AFTER all four slots fill". The
 * current page is a sync heading-only skeleton; Plan 05 turns it into an async RSC
 * that threads `getWaitlistCount()` into the proof surfaces and fills the four
 * empty slots. The test asserts the page is that async RSC (HomePage() returns a
 * Promise) BEFORE rendering — so it stays RED on the not-yet-wired sync skeleton
 * now, and the single-h1 assertion only runs against the fully-wired page. This is
 * RED on real missing wiring, not on a missing module and not on an assertion typo.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("(marketing) page — single-h1 invariant (RED until Plan 03-05)", () => {
  it("is an async RSC and renders exactly one level-1 heading after all four slots fill", async () => {
    const { default: HomePage } = await import("@/app/(marketing)/page");

    // Plan 05 makes the page async (threads a single getWaitlistCount() read).
    // Until then it is a sync skeleton → this guard keeps the test RED.
    const rendered = HomePage();
    expect(rendered).toBeInstanceOf(Promise);

    // Single top-level heading (the hero h1) on the fully-wired async page.
    const { getAllByRole } = render(await rendered);
    expect(getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
