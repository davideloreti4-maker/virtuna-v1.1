/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TruthfulnessCallout } from "@/components/app/truthfulness-callout";

/**
 * PROFILE-12 — Truthfulness callout exact-copy contract (D-04 + UI-SPEC §Copywriting).
 * The exact string is the load-bearing requirement; if the implementation drifts the
 * UI's behavioral promise to the creator breaks. UI-SPEC §Color requires NO coral
 * (`bg-accent` / `border-accent`) on this surface — it is informational, not a CTA.
 */
describe("TruthfulnessCallout", () => {
  it("renders the exact copy contract — 'Honest answers improve your prediction accuracy by ~30%.'", () => {
    render(<TruthfulnessCallout />);
    expect(
      screen.getByText("Honest answers improve your prediction accuracy by ~30%.")
    ).toBeInTheDocument();
  });

  it("renders as a non-interactive note (role='note')", () => {
    render(<TruthfulnessCallout />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("does NOT apply coral accent styling to the container (no bg-accent or border-accent classes)", () => {
    const { container } = render(<TruthfulnessCallout />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInstanceOf(HTMLElement);
    const cls = rootDiv.className;
    expect(cls).not.toContain("bg-accent");
    expect(cls).not.toContain("border-accent");
    // Defense-in-depth: textContent contains the exact string.
    expect(rootDiv.textContent).toBe(
      "Honest answers improve your prediction accuracy by ~30%."
    );
  });
});
