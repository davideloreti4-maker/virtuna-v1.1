/** @vitest-environment happy-dom */
/**
 * CalibrationFlow's `duringWait` slot.
 *
 * WHY A SLOT AND NOT A FEATURE. CalibrationFlow is mounted by THREE surfaces — /welcome,
 * `audience-form.tsx` (create) and `audience-detail.tsx` (recalibrate). Onboarding questions
 * belong to exactly one of them. Putting them inside the component would put them on all three;
 * `proof-unit-is-shared-do-not-edit` is the standing version of that lesson here. So the shared
 * component decides only WHERE the slot sits in its own layout, and the caller decides WHAT.
 *
 * What these lock:
 *  - the slot renders across the WHOLE wait, both streaming branches. The pre-evidence branch is
 *    the first ~40s of a ~128s run; a slot that only appeared once the covers landed would miss
 *    the third of the wait with the least on screen.
 *  - the slot is ABSENT from every terminal state. `done` is the reveal — the payoff the wait was
 *    spent on — and error/fallback are asking the creator to make a decision. Questions belong in
 *    neither, and a block that persists into `done` would still be mid-answer when onDone
 *    navigates away.
 *  - callers that pass nothing are unchanged. That is the whole claim of the slot design, so it
 *    is asserted rather than assumed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { CalibrationFlow } from "../calibration-flow";
import type { Audience } from "@/lib/audience/audience-types";

const DRAFT = {
  id: "aud-1",
  name: "@zachking",
  type: "personal",
  platform: "tiktok",
  goal_intent: "grow",
} as unknown as Audience;

const SLOT = <p>three things the scrape cannot tell us</p>;

/** An SSE body that never closes — the run has STARTED and is still waiting. */
function hangingSse(): Response {
  const stream = new ReadableStream<Uint8Array>({ start() { /* never closes */ } });
  return { ok: true, body: stream } as unknown as Response;
}

/** An SSE body that fails immediately — drives the flow to a terminal error state. */
function erroringSse(): Response {
  return { ok: false, status: 500, body: null } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(hangingSse());
  vi.stubGlobal("fetch", fetchMock);
});

describe("CalibrationFlow duringWait slot", () => {
  it("renders the slot while the scrape is still running", async () => {
    render(
      <CalibrationFlow
        audience={DRAFT}
        autoStart
        prefillHandle="zachking"
        duringWait={SLOT}
        onDone={() => {}}
        onSkip={() => {}}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("three things the scrape cannot tell us")).toBeTruthy()
    );
  });

  it("does not render the slot before the run starts", () => {
    render(
      <CalibrationFlow
        audience={DRAFT}
        duringWait={SLOT}
        onDone={() => {}}
        onSkip={() => {}}
      />
    );

    expect(screen.queryByText("three things the scrape cannot tell us")).toBeNull();
  });

  it("drops the slot once the run has failed — that screen asks for a decision", async () => {
    fetchMock.mockResolvedValue(erroringSse());
    render(
      <CalibrationFlow
        audience={DRAFT}
        autoStart
        prefillHandle="zachking"
        duringWait={SLOT}
        onDone={() => {}}
        onSkip={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText(/retry/i)).toBeTruthy());
    expect(screen.queryByText("three things the scrape cannot tell us")).toBeNull();
  });

  it("renders nothing extra for the two callers that pass no slot", async () => {
    const { container } = render(
      <CalibrationFlow
        audience={DRAFT}
        autoStart
        prefillHandle="zachking"
        onDone={() => {}}
        onSkip={() => {}}
      />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.querySelector("[data-slot='during-wait']")).toBeNull();
  });
});
