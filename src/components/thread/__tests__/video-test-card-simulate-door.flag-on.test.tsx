/** @vitest-environment happy-dom */
/**
 * The video card's way to its result under the new look. Since thread answers step 1 the thread
 * draws a `video-test-card` as the new video card (`VideoAnswer`, Task 5), not the legacy card: its
 * one primary, "Open simulation", is a link to the run's result page at /simulation/[id]. The legacy
 * "Simulate with your audience" door is not drawn, and the room (`SimulateVideoContext`) is never
 * asked. The flag-off door is held by video-test-card-simulate-door.test.tsx.
 *
 * Real: the turn, the card, TanStack Query. Stood in for: the network (`fetch`), answered with the
 * result page's stored-row fixture.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build.
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { SimulateVideoContext } from "@/lib/hook-test-context";
import type { VideoTestCardBlock } from "@/lib/tools/blocks";
import { renderWithClient } from "@/test/render-with-client";
import { ThreadTurn } from "../thread-turn";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("the video card's link to its result, flag on", () => {
  it("in a thread: the new card's 'Open simulation' links to /simulation/an-1; no legacy door; the room is not asked", async () => {
    const fetchMock = vi.fn(async (_url: string) => json(middle));
    vi.stubGlobal("fetch", fetchMock);
    const simulate = vi.fn(() => true);
    renderWithClient(
      <SimulateVideoContext.Provider value={simulate}>
        <ThreadTurn userTurn="take.mp4" blocks={[block]} />
      </SimulateVideoContext.Provider>,
    );
    const link = await screen.findByRole("link", { name: "Open simulation" });
    expect(link).toHaveAttribute("href", "/simulation/an-1");
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain("/api/analysis/an-1");
    expect(screen.queryByText(/Simulate with your audience/)).toBeNull();
    fireEvent.click(link);
    expect(simulate).not.toHaveBeenCalled();
  });
});
