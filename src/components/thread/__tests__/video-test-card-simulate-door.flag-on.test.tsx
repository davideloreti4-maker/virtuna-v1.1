/** @vitest-environment happy-dom */
/**
 * The Test card's door under the new look (result page plan, Task 2): it opens the run's result
 * page at /simulation/[id], everywhere, and never hands the run to the room's side panel.
 * The flag-off behaviour is held by video-test-card-simulate-door.test.tsx.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build.
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
// The Save icon needs a react-query provider and is not what this suite is about.
vi.mock("../save-affordance", () => ({ SaveAffordance: () => null }));

import { VideoTestCardRenderer } from "../video-test-card-block";
import { SimulateVideoContext } from "@/lib/hook-test-context";
import type { VideoTestCardBlock } from "@/lib/tools/blocks";

afterEach(() => {
  cleanup();
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

describe("the Test card's door, flag on", () => {
  it("off-composer: a link to the result page", () => {
    render(<VideoTestCardRenderer block={block} />);
    expect(screen.getByRole("link", { name: CTA }).getAttribute("href")).toBe("/simulation/an-1");
  });

  it("inside the composer: still the link, and the room is not asked", () => {
    const simulate = vi.fn(() => true);
    render(
      <SimulateVideoContext.Provider value={simulate}>
        <VideoTestCardRenderer block={block} />
      </SimulateVideoContext.Provider>,
    );
    const link = screen.getByRole("link", { name: CTA });
    expect(link.getAttribute("href")).toBe("/simulation/an-1");
    fireEvent.click(link);
    expect(simulate).not.toHaveBeenCalled();
  });
});
