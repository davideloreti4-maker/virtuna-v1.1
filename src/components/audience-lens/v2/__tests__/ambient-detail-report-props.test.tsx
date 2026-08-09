/** @vitest-environment happy-dom */
/**
 * The OPT-IN surface the v8 verdict report uses to reuse the drill: `tabOrder` (the spec's
 * Audience-first order) and the template's `personaRead` (the personas-only grade of the
 * EXISTING PopulationFrame — the deleted `audienceSlot` fork's replacement, 2026-08-09
 * ruling). Both default off — the assertions below pin that the drill's own settled
 * behaviour is unchanged when neither is present.
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

  it("a personaRead template renders the EXISTING PopulationFrame at its reduced grade, and opens on it", () => {
    render(
      <AmbientDetail
        template={template({
          personaRead: {
            stop: 7,
            total: 10,
            stopped: [{ who: "a viewer", quote: "ok that's me" }],
            scrolled: [{ who: "another", quote: "seen it" }],
          },
        })}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
      />,
    );
    expect(screen.getByTestId("report-verdict")).toHaveTextContent("7/10");
    expect(screen.getAllByTestId(/^report-face-/)).toHaveLength(10);
    expect(screen.queryByText(/no run yet/i)).toBeNull();
  });

  it("a personaRead un-dims the Audience tab (there IS something behind it)", () => {
    render(
      <AmbientDetail
        template={template({
          personaRead: { stop: 7, total: 10, stopped: [], scrolled: [] },
        })}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
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

  it("skips the nav strip entirely when there is neither a back button nor a pager", () => {
    render(<AmbientDetail template={template()} presentation="sheet" />);
    expect(screen.queryByTestId("ambient-detail-nav")).toBeNull();
  });

  it("keeps the nav strip for a drill template that has a pager", () => {
    render(<AmbientDetail template={template({ pager: "hook 2 of 5" })} presentation="sheet" />);
    expect(screen.getByTestId("ambient-detail-nav")).toBeInTheDocument();
  });
});
