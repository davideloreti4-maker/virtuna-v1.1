/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonaAudienceFrame } from "../persona-audience-frame";
import { personasToReportRead } from "@/lib/surfaces/v8-report";
import type { ReactionPersona } from "@/lib/tools/blocks";

function personas(stops: number, total = 10): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i < stops ? `stopped ${i}` : `scrolled ${i}`,
  }));
}

describe("PersonaAudienceFrame", () => {
  it("states the verdict and draws exactly ten faces, lit = stopped", () => {
    render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} />);
    expect(screen.getByTestId("report-verdict")).toHaveTextContent("7/10");
    expect(screen.getByText(/stopped scrolling/i)).toBeInTheDocument();
    const faces = screen.getAllByTestId(/^report-face-/);
    expect(faces).toHaveLength(10);
    expect(faces.filter((f) => f.dataset.lit === "true")).toHaveLength(7);
  });

  it("counts each group by PEOPLE and prints their real words", () => {
    render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} />);
    expect(screen.getByTestId("report-group-stopped")).toHaveTextContent("7");
    expect(screen.getByTestId("report-group-scrolled")).toHaveTextContent("3");
    expect(screen.getByText(/stopped 0/)).toBeInTheDocument();
    expect(screen.getByText(/scrolled 7/)).toBeInTheDocument();
  });

  it("omits a group entirely when nobody in it spoke — never an empty header", () => {
    const read = personasToReportRead(personas(10));
    render(<PersonaAudienceFrame read={read} />);
    expect(screen.queryByTestId("report-group-scrolled")).toBeNull();
  });

  it("the fix action names the REAL number it is asking you to win back", () => {
    const onSteer = vi.fn();
    render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} onSteer={onSteer} />);
    fireEvent.click(screen.getByRole("button", { name: /fix what lost them/i }));
    expect(onSteer).toHaveBeenCalledWith("Rewrite the hook to win back the 3 who scrolled past.");
  });

  it("renders no fix action when nobody scrolled (nothing to fix)", () => {
    render(<PersonaAudienceFrame read={personasToReportRead(personas(10))} onSteer={() => {}} />);
    expect(screen.queryByRole("button", { name: /fix what lost them/i })).toBeNull();
  });

  it("spends ZERO accent (locked) and never prints #fff", () => {
    const { container } = render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} />);
    expect(container.innerHTML).not.toMatch(/FF6363/i);
    expect(container.innerHTML).not.toMatch(/bg-accent|text-accent/);
    expect(container.innerHTML).not.toMatch(/#fff\b|#ffffff/i);
  });
});
