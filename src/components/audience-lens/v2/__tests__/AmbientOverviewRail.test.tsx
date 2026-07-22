/** @vitest-environment happy-dom */
/**
 * AmbientOverviewRail — the parallel-run mount of the Ambient v2 surfaces in the composer rail.
 *
 * The integration this locks: a live `Audience` + the thread's projected-card ledger flow through
 * `audienceToMeta` → `buildOverviewData` → the rendered Overview, so the ranked list shows the REAL
 * projected stimuli under the REAL audience name — no fixture, no fabrication. (The pure segment/cast
 * derivation is unit-tested in `ambient-v2-adapters.test.ts`; this proves the glue renders.)
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AmbientOverviewRail } from "../AmbientOverviewRail";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const audience: Audience = { ...GENERAL_AUDIENCE, name: "Your audience" };

const descriptors: AmbientCardDescriptor[] = [
  { id: "hook-0", kind: "hook", conceptText: "Nobody tells you the first 10k…", fraction: "3/10 stop", scrollQuote: "" },
  { id: "idea-1", kind: "idea", conceptText: "I quit my 9-5 with $400…", fraction: "9/10 stop", scrollQuote: "" },
];

describe("AmbientOverviewRail", () => {
  it("renders the real audience + the projected ledger as the ranked Overview", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    // the real audience name (mapped via audienceToMeta)
    expect(screen.getByText("Your audience")).toBeTruthy();
    // both projected stimuli render as ranked rows (real data, not a fixture)
    expect(screen.getByText(/Nobody tells you the first 10k/)).toBeTruthy();
    expect(screen.getByText(/I quit my 9-5 with \$400/)).toBeTruthy();
  });

  it("renders the Overview (not Simulate) at rest — the develop surface is gated behind a rank tap", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    expect(screen.getByTestId("ambient-overview")).toBeTruthy();
  });
});
