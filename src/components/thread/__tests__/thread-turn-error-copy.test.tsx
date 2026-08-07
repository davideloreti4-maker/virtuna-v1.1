/** @vitest-environment happy-dom */

/**
 * The glass resolves a run failure's copy by CAUSE first, skill second.
 *
 * Before this, `thread-turn.tsx` keyed the copy by skill alone, so an Explore run that died
 * offline rendered "Check the handle or niche and try again" — an accusation against a handle
 * that is perfectly fine, aimed at a user who cannot act on it. Same defect class as the
 * calibrate copy PR #449 fixed, where the wrong sentence costs a paid scrape to act on.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ThreadTurn } from "@/components/thread/thread-turn";
import type { ChatTurnKind } from "@/lib/tools/chat-followups";
import { RUN_FAILURE_SENTINEL } from "@/lib/net/run-failure";

afterEach(cleanup);

/**
 * `skill` is NOT a prop — ThreadTurn derives it (thread-turn.tsx:196) as
 * `live?.skill ?? header?.skill ?? classifyTurn(blockTypes)`, so the live run is how a test
 * names it. `LiveRun` requires `skill` and `isStreaming`.
 */
function renderError(error: string, skill: ChatTurnKind) {
  return render(
    <ThreadTurn
      blocks={[]}
      live={{ skill, isStreaming: false, stages: [], error, onRetry: () => {} }}
    />,
  );
}

describe("the glass resolves cause before skill", () => {
  it("an OFFLINE explore failure does not accuse the handle", () => {
    const { container } = renderError(RUN_FAILURE_SENTINEL.offline, "explore");
    expect(container.textContent).not.toMatch(/handle or niche/i);
    expect(container.textContent).toMatch(/offline/i);
  });

  it("an ordinary explore failure still gets Explore's own copy", () => {
    const { container } = renderError("Explore request failed", "explore");
    expect(container.textContent).toMatch(/handle or niche/i);
  });

  it("a SESSION failure outranks the skill copy too", () => {
    const { container } = renderError(RUN_FAILURE_SENTINEL.session, "explore");
    expect(container.textContent).not.toMatch(/handle or niche/i);
    expect(container.textContent).toMatch(/signed out|session/i);
  });

  it("never renders the raw sentinel to the user", () => {
    const { container } = renderError(RUN_FAILURE_SENTINEL.offline, "ideas");
    expect(container.textContent).not.toContain("maven:run-failure");
  });

  it("keeps the alert role — a failure must be announced, not merely drawn", () => {
    renderError(RUN_FAILURE_SENTINEL.offline, "ideas");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("still renders the generic copy for a generative skill that really did drop out", () => {
    const { container } = renderError("Ideas stream error", "ideas");
    expect(container.textContent).toMatch(/dropped out/i);
  });
});
