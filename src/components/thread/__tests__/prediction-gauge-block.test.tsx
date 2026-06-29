/** @vitest-environment happy-dom */
/**
 * prediction-gauge-block.test.tsx — the honest gauge renderer + schema (Wave 0, → 06-04).
 *
 * RED by design: imports `PredictionGaugeBlockRenderer` + `PredictionGaugeBlockSchema`, which
 * do NOT exist until 06-04 (module-not-found = the intended Nyquist RED). 06-04 turns it GREEN.
 *
 * Locks (06-UI-SPEC Surface 1 — honesty made visible):
 *   - `.strict()` rejects a smuggled point-score (`{ ...validProps, score: 73 }` → fail);
 *   - the card reads WITHOUT relying on color: the band WORD + a `~min–max%` caption are
 *     present as TEXT (queried by text, never by colour) — no oracle dial, no false precision;
 *   - a single-point panel (`min === max`) STILL renders a span element (F-01 feather, not a
 *     bare tick) — the range is always a band, never a needle.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render as rtlRender, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PredictionGaugeBlockRenderer,
  PredictionGaugeBlockSchema,
} from "@/components/thread/prediction-gauge-block";

afterEach(() => cleanup());

// The renderer mounts SaveAffordance (useSaveItem → useQueryClient), so every render
// must sit under a QueryClientProvider (mirrors idea-card-block.test.tsx precedent).
function render(ui: Parameters<typeof rtlRender>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ─── Fixture ────────────────────────────────────────────────────────────────────────

type GaugeProps = Parameters<typeof PredictionGaugeBlockRenderer>[0]["block"]["props"];

function makeProps(over: Partial<GaugeProps> = {}): GaugeProps {
  return {
    audienceName: "Analyst Panel",
    scenario: "Will this hook break 100k views?",
    band: "Lean yes",
    range: { min: 35, max: 90 },
    confidence: "Medium",
    factors: [
      { analystArchetype: "tough_crowd", driver: "The hook buries the payoff.", direction: "against" },
      { analystArchetype: "purposeful_viewer", driver: "The promise is concrete.", direction: "for" },
    ],
    panel: [
      { archetype: "tough_crowd", lean: "lean_no", reasoning: "Skeptics bounce early." },
      { archetype: "purposeful_viewer", lean: "lean_yes", reasoning: "A clear deliverable earns the watch." },
    ],
    assumptions: ["The hook ships as written."],
    successCriterion: "Surfaces the sharpest risk.",
    caveat: "Directional — a synthetic panel, not a guarantee.",
    model: "sim1-flash",
    tier: "Directional",
    ...over,
  } as GaugeProps;
}

function makeBlock(over: Partial<GaugeProps> = {}) {
  return { type: "prediction-gauge" as const, props: makeProps(over) };
}

// ─── Schema: .strict() rejects a smuggled point-score ───────────────────────────────

describe("PredictionGaugeBlockSchema — .strict()", () => {
  it("parses valid props", () => {
    expect(PredictionGaugeBlockSchema.safeParse(makeBlock()).success).toBe(true);
  });

  it("rejects a smuggled point-score on props (no oracle number)", () => {
    const bad = { type: "prediction-gauge", props: { ...makeProps(), score: 73 } };
    expect(PredictionGaugeBlockSchema.safeParse(bad).success).toBe(false);
  });
});

// ─── Renderer: readable without color ────────────────────────────────────────────────

describe("PredictionGaugeBlockRenderer — readable without colour", () => {
  it("shows the band WORD as text", () => {
    render(<PredictionGaugeBlockRenderer block={makeBlock({ band: "Lean yes" })} />);
    expect(screen.getByText(/Lean yes/i)).toBeTruthy();
  });

  it("shows the ~min–max% range caption as text (panel-derived, the only numeric)", () => {
    render(<PredictionGaugeBlockRenderer block={makeBlock({ range: { min: 35, max: 90 } })} />);
    // The caption reads as a band "~35–90%", never a single oracle number.
    expect(screen.getByText(/35.*90%/)).toBeTruthy();
  });
});

// ─── Renderer: single-point feather (F-01) ───────────────────────────────────────────

describe("PredictionGaugeBlockRenderer — single-point feather (F-01)", () => {
  it("renders a span element even when min === max (a band, never a bare tick)", () => {
    const { container } = render(
      <PredictionGaugeBlockRenderer block={makeBlock({ range: { min: 60, max: 60 } })} />,
    );
    expect(container.querySelector("span")).not.toBeNull();
    // Still reads as a percentage band, not a naked needle.
    expect(screen.getByText(/60%/)).toBeTruthy();
  });
});
