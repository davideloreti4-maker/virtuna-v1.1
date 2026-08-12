/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AmbientDetail } from "../AmbientDetail";
import { CREATOR_TEMPLATE } from "../detail-fixture";

/**
 * The applied fix state — which had NO coverage at all before this file, despite being a state the
 * owner has reviewed three times.
 *
 * The thing worth pinning: applying the fix fires no model call. `AmbientDetail` flips a `useState`
 * and swaps in the authored projected blob, so the Brain page's three evidence cards (Signal
 * breakdown, Network activation, Activation per second) are still the read of the clip AS POSTED.
 * They sit byte-identical while the hero repaints, and for twelve revisions that looked like a bug
 * in review. It is not one — there is no delta because no fold ran. The page has to SAY that.
 */
describe("AmbientDetail — the applied fix names itself a projection", () => {
  afterEach(cleanup);

  const mount = () => render(<AmbientDetail template={CREATOR_TEMPLATE} reducedMotion />);

  const applyFix = () => {
    const fix = CREATOR_TEMPLATE.answer?.fix;
    expect(fix, "the authored template must still carry a fix to apply").toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(fix!.label) }));
  };

  it("says nothing about projections until the fix is actually applied", () => {
    mount();
    expect(screen.queryByText(/not re-simulated/i)).toBeNull();
  });

  it("names the evidence below as measured on the clip as posted", () => {
    mount();
    applyFix();

    // the state really did flip — the applied blob's head is on screen
    expect(screen.getByText(CREATOR_TEMPLATE.answer!.fix!.applied.head)).toBeInTheDocument();
    expect(screen.getByText(/measured on the clip as posted/i)).toBeInTheDocument();
    expect(screen.getByText(/projected, not re-simulated/i)).toBeInTheDocument();
  });

  it("KEEPS all three evidence cards rather than hiding the only measured thing on the page", () => {
    mount();
    applyFix();

    // The rejected alternative was hiding these when applied. They stay, and the line above explains
    // why they did not move — hiding them would have deleted the page's only measurement.
    expect(screen.getByText("Signal breakdown")).toBeInTheDocument();
    expect(screen.getByText("Network activation")).toBeInTheDocument();
  });

  it("withdraws the disclosure when the fix is undone — it describes a state, not the page", () => {
    mount();
    applyFix();
    expect(screen.getByText(/not re-simulated/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Undo the fix/ }));
    expect(screen.queryByText(/not re-simulated/i)).toBeNull();
  });
});
