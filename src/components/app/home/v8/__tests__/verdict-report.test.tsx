/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { VerdictReport, type ReportSubject } from "../verdict-report";
import type { Audience } from "@/lib/audience/audience-types";
import type { ReactionPersona } from "@/lib/tools/blocks";

const audience = {
  id: "aud-1",
  name: "Your people",
  platform: "tiktok",
  is_general: false,
  personas: [],
} as unknown as Audience;

function personas(stops: number, total = 10): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i < stops ? `stopped ${i}` : `scrolled ${i}`,
  }));
}

const subject: ReportSubject = {
  id: "drop-1",
  title: "I sit 10 hours a day. Stretching didn't fix me — this did.",
  personas: personas(7),
};

type Props = Parameters<typeof VerdictReport>[0];

function base(over: Partial<Props> = {}): Props {
  return {
    open: true,
    onClose: vi.fn(),
    subject,
    audience,
    variant: "sheet",
    reducedMotion: true,
    ...over,
  };
}

describe("VerdictReport", () => {
  it("renders nothing when closed", () => {
    render(<VerdictReport {...base({ open: false })} />);
    expect(screen.queryByTestId("verdict-report")).toBeNull();
  });

  it("mobile: a bottom sheet with the three tabs, Audience first", () => {
    render(<VerdictReport {...base()} />);
    const report = screen.getByTestId("verdict-report");
    expect(report.dataset.variant).toBe("sheet");
    const tabs = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") !== null)
      .map((t) => t.textContent);
    expect(tabs).toEqual(["Audience", "Brain", "Engagement"]);
  });

  it("reads the subject's CACHED personas — the verdict on screen is their real tally", () => {
    render(<VerdictReport {...base()} />);
    expect(screen.getByTestId("report-verdict")).toHaveTextContent("7/10");
  });

  it("Escape closes", () => {
    const onClose = vi.fn();
    render(<VerdictReport {...base({ onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the scrim closes on mobile", () => {
    const onClose = vi.fn();
    render(<VerdictReport {...base({ onClose })} />);
    fireEvent.click(screen.getByTestId("verdict-report-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers NO pin anywhere — the report is an event, never furniture (2026-08-09 rail ruling)", () => {
    render(<VerdictReport {...base({ variant: "panel" })} />);
    expect(screen.queryByRole("button", { name: /pin/i })).toBeNull();
    cleanup();
    render(<VerdictReport {...base()} />);
    expect(screen.queryByRole("button", { name: /pin/i })).toBeNull();
  });

  it("the desktop panel is an overlay over a scrim — nothing docks into the page", () => {
    render(<VerdictReport {...base({ variant: "panel" })} />);
    expect(screen.getByTestId("verdict-report-scrim")).toBeInTheDocument();
    // Portaled to <body>, not into any layout column.
    expect(screen.getByTestId("verdict-report").parentElement).toBe(document.body);
  });

  it("withholds the verdict while a run is in flight (the sealed-verdict law)", () => {
    render(<VerdictReport {...base({ subject: null, watching: true })} />);
    expect(screen.getByTestId("verdict-report")).toHaveTextContent(/watching/i);
    expect(screen.queryByTestId("report-verdict")).toBeNull();
  });

  it("no subject and no run: an honest empty, never a fabricated figure", () => {
    render(<VerdictReport {...base({ subject: null })} />);
    expect(screen.queryByTestId("report-verdict")).toBeNull();
    expect(screen.getByTestId("verdict-report")).toHaveTextContent(/nothing simulated yet/i);
  });

  it("spends no accent at all (locked)", () => {
    render(<VerdictReport {...base()} />);
    const html = screen.getByTestId("verdict-report").innerHTML;
    expect(html).not.toMatch(/bg-accent|text-accent/);
    expect(html).not.toMatch(/FF6363/i);
  });
});
