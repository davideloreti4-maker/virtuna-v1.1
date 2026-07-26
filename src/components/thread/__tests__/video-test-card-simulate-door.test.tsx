/** @vitest-environment happy-dom */
/**
 * The Test card's ONE door out — "Simulate with your audience →".
 *
 * The card owns CRAFT and hands RECEPTION to the simulation. That simulation is not a new run: the
 * analyze pass already measured it against this thread's audience and `/api/tools/test/card` sealed
 * it, so inside the composer the CTA OPENS the room on that seal instead of navigating to the old
 * `/analyze` board.
 *
 * Three states, all load-bearing:
 *   - in the composer, with a seal   → a BUTTON that hands the analysisId to the room
 *   - off-composer (library / saved / the /dev/cards gallery) → the /analyze link, untouched
 *   - in the composer, NO seal       → the room declines, and the card must still go somewhere
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { VideoTestCardRenderer } from "../video-test-card-block";
import { SimulateVideoContext } from "@/lib/hook-test-context";
import type { VideoTestCardBlock } from "@/lib/tools/blocks";

// The Save icon is the OTHER footer affordance and needs a react-query provider. It is not what
// this suite is about, so stub it rather than mounting a QueryClient around every case.
vi.mock("../save-affordance", () => ({ SaveAffordance: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const block: VideoTestCardBlock = {
  type: "video-test-card",
  props: {
    craftScore: 77,
    drivers: [{ name: "Hook", score: 82, band: "strong" }],
    filmstrip: [],
    dropLabel: null,
    durationLabel: "0:29",
    working: ["The cold open lands"],
    notWorking: [],
    fixes: [],
    audienceName: "Your audience",
    analysisId: "an-1",
    model: "sim1-max",
    tier: "Validated",
  },
};

const CTA = /Simulate with your audience/;

describe("the Test card's Simulate door", () => {
  it("off-composer it stays the /analyze link — library, saved and the card gallery are unaffected", () => {
    render(<VideoTestCardRenderer block={block} />);
    const link = screen.getByRole("link", { name: CTA });
    expect(link.getAttribute("href")).toBe("/analyze/an-1");
  });

  it("inside the composer it hands the analysisId to the room instead of navigating out", () => {
    const simulate = vi.fn(() => true); // the room has a sealed video for this run
    render(
      <SimulateVideoContext.Provider value={simulate}>
        <VideoTestCardRenderer block={block} />
      </SimulateVideoContext.Provider>,
    );
    // NOT a link any more — no navigation away from the thread
    expect(screen.queryByRole("link", { name: CTA })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: CTA }));
    expect(simulate).toHaveBeenCalledWith("an-1");
  });

  it("falls back to /analyze when the room declines — never an inert button", () => {
    // The room returns false when there is nothing to open: the ambient room is off, or the run
    // degraded before producing an attention curve, so no video seal exists.
    const simulate = vi.fn(() => false);
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign },
    });
    render(
      <SimulateVideoContext.Provider value={simulate}>
        <VideoTestCardRenderer block={block} />
      </SimulateVideoContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: CTA }));
    expect(simulate).toHaveBeenCalledWith("an-1");
    expect(assign).toHaveBeenCalledWith("/analyze/an-1");
  });
});
