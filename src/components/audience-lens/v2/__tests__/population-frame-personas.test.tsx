/** @vitest-environment happy-dom */
/**
 * PopulationFrame at its PERSONAS-ONLY grade (v8 report — a drop's cached read).
 *
 * This grade replaced the deleted `PersonaAudienceFrame` fork (owner ruling 2026-08-09: the
 * audience page is the audience page we already had — one component, two data grades). The
 * projection strip (terrain, pools, "1,000 simulated") must be OMITTED, never synthesized.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PopulationFrame } from "../AudienceTab";
import { personasToReportRead } from "@/lib/surfaces/v8-report";
import type { ReactionPersona } from "@/lib/tools/blocks";

function personas(stops: number, total = 10): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i < stops ? `stopped ${i}` : `scrolled ${i}`,
  }));
}

const VERDICT = { value: "7/10", label: "stopped scrolling" };

function renderReduced(stops: number, onSteer?: (s: string) => void) {
  return render(
    <PopulationFrame
      personaRead={personasToReportRead(personas(stops))}
      verdict={VERDICT}
      onSteer={onSteer}
    />,
  );
}

describe("PopulationFrame — personas-only grade", () => {
  it("states the verdict and draws exactly ten faces, lit = stopped", () => {
    renderReduced(7);
    expect(screen.getByTestId("report-verdict")).toHaveTextContent("7/10");
    expect(screen.getByText(/stopped scrolling/i)).toBeInTheDocument();
    const faces = screen.getAllByTestId(/^report-face-/);
    expect(faces).toHaveLength(10);
    expect(faces.filter((f) => f.dataset.lit === "true")).toHaveLength(7);
  });

  it("counts each group by PEOPLE and prints their real words", () => {
    renderReduced(7);
    expect(screen.getByTestId("report-group-stopped")).toHaveTextContent("7");
    expect(screen.getByTestId("report-group-scrolled")).toHaveTextContent("3");
    expect(screen.getByText(/stopped 0/)).toBeInTheDocument();
    expect(screen.getByText(/scrolled 7/)).toBeInTheDocument();
  });

  it("omits a group entirely when nobody in it spoke — never an empty header", () => {
    renderReduced(10);
    expect(screen.queryByTestId("report-group-scrolled")).toBeNull();
  });

  it("omits the projection strip — no terrain, no pools, no '1,000 simulated'", () => {
    const { container } = renderReduced(7);
    expect(container.querySelector("svg[data-testid='terrain-map']")).toBeNull();
    expect(container.textContent).not.toMatch(/1,000|simulated · confidence/i);
  });

  it("the fix action names the REAL number it is asking you to win back", () => {
    const onSteer = vi.fn();
    renderReduced(7, onSteer);
    fireEvent.click(screen.getByRole("button", { name: /fix what lost them/i }));
    expect(onSteer).toHaveBeenCalledWith("Rewrite the hook to win back the 3 who scrolled past.");
  });

  it("renders no fix action when nobody scrolled (nothing to fix)", () => {
    renderReduced(10, () => {});
    expect(screen.queryByRole("button", { name: /fix what lost them/i })).toBeNull();
  });

  it("renders nothing at all with neither grade — never a fabricated figure", () => {
    const { container } = render(<PopulationFrame verdict={VERDICT} />);
    expect(container.textContent).toBe("");
  });

  it("spends ZERO accent (locked) and never prints #fff", () => {
    const { container } = renderReduced(7);
    expect(container.innerHTML).not.toMatch(/FF6363/i);
    expect(container.innerHTML).not.toMatch(/bg-accent|text-accent/);
    expect(container.innerHTML).not.toMatch(/#fff\b|#ffffff/i);
  });
});
