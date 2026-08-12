/** @vitest-environment happy-dom */
/**
 * BrainTab — the cortex must be GROUNDED on the room's real retention.
 *
 * `cortex-sim` shipped a grounded mode, `cortex-sim.test.ts` covered it, and the suite was green —
 * while `BrainTab` hardcoded `mode: "simulated"` and every video drill looped a seeded envelope
 * carrying no information about the video. The model was tested; the WIRING was not, and that is
 * the only place the bug could live.
 *
 * `driveFor` now owns the mode choice (`drive-for.test.ts` covers it). What is asserted HERE is the
 * one thing that file cannot see: that BrainTab actually hands the curve over. Strip
 * `retentionCurve` and the two renders collapse to the same cortex — which is exactly the defect.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, waitFor } from "@testing-library/react";
import { BrainFrame } from "../BrainTab";
import { CREATOR_TEMPLATE } from "../detail-fixture";
import type { BrainFrameData } from "../domain-template";

// The cortex is WebGL — no GL context in happy-dom. Record the `bold` map it is handed instead:
// that map IS the readout, so comparing it compares what the user would see.
// NOTE the path: BrainTab imports "../CortexCanvas" from `v2/`, so the module id is
// `audience-lens/CortexCanvas` — two levels up from this file, not one.
const seen: Record<string, number>[] = [];
vi.mock("../../CortexCanvas", () => ({
  default: ({ bold }: { bold: Record<string, number> }) => {
    seen.push(bold);
    return <div data-testid="cortex-canvas" />;
  },
}));

afterEach(() => {
  cleanup();
  seen.length = 0;
});

const brain = CREATOR_TEMPLATE.brain as BrainFrameData;
const verdict = CREATOR_TEMPLATE.verdict;

/** Render once with reducedMotion (a fixed playhead, no RAF) and return the bold map handed over.
 *  CortexCanvas arrives through `next/dynamic`, so the mock lands a tick after mount. */
async function boldFor(b: BrainFrameData): Promise<Record<string, number>> {
  render(<BrainFrame brain={b} verdict={verdict} reducedMotion />);
  await waitFor(() => expect(seen.length).toBeGreaterThan(0));
  return seen[seen.length - 1]!;
}

describe("BrainTab — the cortex reads the real curve", () => {
  it("the authored fixture carries a retention curve at all", () => {
    // Guards the fixture itself: without this the comparison below would pass vacuously by
    // comparing two identical simulated renders.
    expect(Array.isArray(brain.retentionCurve)).toBe(true);
    expect(brain.retentionCurve!.length).toBeGreaterThan(1);
  });

  it("mounts the cortex", async () => {
    render(<BrainFrame brain={brain} verdict={verdict} reducedMotion />);
    expect(await screen.findByTestId("cortex-canvas")).toBeTruthy();
  });

  it("passes the curve through — dropping it changes the cortex", async () => {
    const withCurve = await boldFor(brain);
    cleanup();
    seen.length = 0;
    const { retentionCurve: _drop, ...noCurve } = brain;
    const without = await boldFor(noCurve as BrainFrameData);

    const ids = Object.keys(withCurve);
    expect(ids.length).toBeGreaterThan(0);
    const gap = Math.max(...ids.map((k) => Math.abs(withCurve[k]! - (without[k] ?? 0))));
    // If BrainTab ever stops forwarding `retentionCurve`, both renders fall back to the seeded
    // envelope, this gap goes to 0, and this test fails — which is the whole point of it.
    expect(gap).toBeGreaterThan(0.05);
  });

  it("the curve — not the card's id — decides the response", async () => {
    const a = await boldFor(brain);
    cleanup();
    seen.length = 0;
    const b = await boldFor({ ...brain, cortexSeedKey: "an-entirely-different-card-id" });
    expect(b).toEqual(a);
  });
});
