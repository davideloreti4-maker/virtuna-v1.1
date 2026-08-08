/** @vitest-environment happy-dom */
/**
 * The two OPT-IN props Phase 3 adds to the drill so the v8 verdict report can reuse it:
 * `tabOrder` (the spec's Audience-first order) and `audienceSlot` (the personas-only frame).
 * Both default off — the assertions below pin that the drill's own settled behaviour is
 * unchanged when neither is passed.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AmbientDetail, REPORT_TAB_ORDER } from "../AmbientDetail";
import type { DomainTemplate } from "../domain-template";

function template(over: Partial<DomainTemplate> = {}): DomainTemplate {
  return {
    id: "v8-report",
    label: "A hook",
    backLabel: "",
    pager: "",
    verdict: { value: "7/10", label: "stopped scrolling" },
    population: null,
    ...over,
  };
}

function tabLabels(): (string | null)[] {
  return screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") !== null)
    .map((t) => t.textContent);
}

describe("AmbientDetail — report props", () => {
  it("keeps the settled drill order by default", () => {
    render(<AmbientDetail template={template()} presentation="sheet" />);
    expect(tabLabels()).toEqual(["Brain", "Engagement", "Audience"]);
  });

  it("honours an explicit tabOrder (the report's Audience-first order)", () => {
    render(<AmbientDetail template={template()} presentation="sheet" tabOrder={REPORT_TAB_ORDER} />);
    expect(tabLabels()).toEqual(["Audience", "Brain", "Engagement"]);
  });

  it("renders audienceSlot instead of the population frame, and opens on it", () => {
    render(
      <AmbientDetail
        template={template()}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
        audienceSlot={<div data-testid="slot">the personas read</div>}
      />,
    );
    expect(screen.getByTestId("slot")).toBeInTheDocument();
    expect(screen.queryByText(/no run yet/i)).toBeNull();
  });

  it("an audienceSlot un-dims the Audience tab (there IS something behind it)", () => {
    render(
      <AmbientDetail
        template={template()}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
        audienceSlot={<div data-testid="slot" />}
      />,
    );
    const audience = screen.getAllByRole("button").find((b) => b.textContent === "Audience")!;
    expect(audience.style.opacity).not.toBe("0.5");
  });

  it("renders no pager chip when the template carries no pager", () => {
    render(<AmbientDetail template={template()} presentation="sheet" />);
    expect(screen.queryByTestId("ambient-detail-pager")).toBeNull();
  });

  it("still renders the pager chip for a drill template that has one", () => {
    render(<AmbientDetail template={template({ pager: "hook 2 of 5" })} presentation="sheet" />);
    expect(screen.getByTestId("ambient-detail-pager")).toHaveTextContent("hook 2 of 5");
  });
});
