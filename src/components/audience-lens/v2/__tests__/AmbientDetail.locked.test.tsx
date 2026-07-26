/** @vitest-environment happy-dom */
/**
 * AmbientDetail — the two honest-absence affordances the /go walkthrough leans on.
 *
 * `population === null` has more than one honest cause, and the component used to assume one of
 * them: it hardcoded "The audience — no run yet." That sentence is correct for a stimulus nobody
 * has run, and WRONG for a run whose audience read is deliberately withheld behind a paywall —
 * where it makes a locked product read as a broken one. Caught in a live browser pass on the
 * walkthrough's wall beat, not by a test, which is why it gets one now.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AmbientDetail } from "../AmbientDetail";
import { CREATOR_LIVE_TEMPLATE } from "../detail-live-fixture";
import type { DomainTemplate } from "../domain-template";

afterEach(cleanup);

const withoutPopulation: DomainTemplate = { ...CREATOR_LIVE_TEMPLATE, population: null };

describe("AmbientDetail — absent population", () => {
  it("still says 'no run yet' when no note is given (the default is unchanged)", () => {
    render(<AmbientDetail template={withoutPopulation} initialTab="audience" />);
    expect(screen.getByText(/no run yet/i)).toBeTruthy();
  });

  it("says what the caller says when the absence is a withheld run, not a missing one", () => {
    render(
      <AmbientDetail
        template={withoutPopulation}
        initialTab="audience"
        populationNote="Your audience's score is what the dollar unlocks."
      />,
    );
    expect(screen.getByText(/what the dollar unlocks/i)).toBeTruthy();
    // The wrong sentence must be GONE, not merely joined by a better one.
    expect(screen.queryByText(/no run yet/i)).toBeNull();
  });

  it("never fabricates a population figure to fill the gap", () => {
    render(<AmbientDetail template={withoutPopulation} initialTab="audience" populationNote="Locked." />);
    expect(screen.queryByText(/1,000/)).toBeNull();
    expect(screen.queryByText(/% would stop/i)).toBeNull();
  });
});

describe("AmbientDetail — the back affordance", () => {
  it("renders a back control when there is somewhere to go back to", () => {
    render(<AmbientDetail template={CREATOR_LIVE_TEMPLATE} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /←/ })).toBeTruthy();
  });

  it("renders NO back control when onBack is omitted", () => {
    // The walkthrough mounts Detail standalone: there is no overview behind it, and a button that
    // silently does nothing is both a dead control and a way off the guided rail.
    render(<AmbientDetail template={CREATOR_LIVE_TEMPLATE} />);
    expect(screen.queryByRole("button", { name: /←/ })).toBeNull();
  });
});
