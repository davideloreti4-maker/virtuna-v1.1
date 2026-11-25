import { describe, expect, it } from "vitest";
import { audienceLayoutFor, DESKTOP_RING_BOX, RING_CARD_INSET } from "../audience-layout";

/** The ring's card in the side-by-side layout: the first of two columns 1 : 1.15, 16 apart. */
const ringCardWidth = (panel: number) => (panel - 16) / 2.15;

describe("audienceLayoutFor", () => {
  it("draws the ring at its full size beside the rows at the design width (588)", () => {
    expect(audienceLayoutFor(588)).toEqual({ stacked: false, ringScale: 1 });
  });

  it("keeps the ring at full size on a wider panel", () => {
    expect(audienceLayoutFor(720)).toEqual({ stacked: false, ringScale: 1 });
  });

  it("shrinks the ring to stay inside its card on a slightly narrower panel (a 1280 window)", () => {
    const layout = audienceLayoutFor(581);
    expect(layout.stacked).toBe(false);
    expect(layout.ringScale).toBeLessThan(1);
    expect(layout.ringScale).toBeGreaterThan(0.95);
    expect(DESKTOP_RING_BOX * layout.ringScale + 2 * RING_CARD_INSET).toBeLessThanOrEqual(ringCardWidth(581));
  });

  it.each([570, 575, 581, 587])("the ring fits its card at %i wide", (panel) => {
    const { stacked, ringScale } = audienceLayoutFor(panel);
    expect(stacked).toBe(false);
    expect(DESKTOP_RING_BOX * ringScale + 2 * RING_CARD_INSET).toBeLessThanOrEqual(ringCardWidth(panel) + 0.001);
  });

  it.each([
    ["a phone", 361],
    ["a tablet held upright (768 window)", 388],
    ["a tablet on its side (1024 window)", 553],
    ["a laptop window with the sidebar open (1240)", 545],
    ["just under the line", 569],
  ])("stacks the ring above the rows on %s", (_name, panel) => {
    expect(audienceLayoutFor(panel)).toEqual({ stacked: true, ringScale: 1 });
  });
});
