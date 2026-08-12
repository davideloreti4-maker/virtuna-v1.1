/** @vitest-environment happy-dom */
/**
 * BroughtCardRenderer — the ＋ door's card in the thread.
 *
 * Two things it must not do, both of which are how the rest of this codebase has been burned:
 *
 *  1. State the count in the WRONG VERB. The engine emits its fraction as "N/10 stop" whatever lens
 *     ran, so a `finish` run rendered as "stopped" would re-word the engine's claim into a stronger
 *     one it never made (the ProofUnit `verb` lesson). The lens the run was armed with picks the verb.
 *  2. Let the ROOM's number pass for a SLICE's. A sliced run asked a different question, so both
 *     numbers are shown and labelled — and when the slice could not be answered the card says so
 *     rather than quietly presenting the room's fraction as the answer.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BroughtCardRenderer } from "../brought-card-block";
import type { BroughtCardBlock } from "@/lib/tools/blocks";

afterEach(cleanup);

const base: BroughtCardBlock = {
  type: "brought-card",
  props: {
    stimulus: "Three years of footage and nobody watched past the first second.",
    kind: "draft",
    lens: "stop",
    band: "Mixed",
    fraction: "4/10 stop",
    scrollQuote: "Heard this one before.",
    model: "sim1-flash",
    scene: "TikTok",
  },
};

/** Deep-ish clone with prop overrides. */
const withProps = (props: Partial<BroughtCardBlock["props"]>): BroughtCardBlock => ({
  type: "brought-card",
  props: { ...base.props, ...props },
});

describe("BroughtCardRenderer", () => {
  it("names it as the creator's own, with the stimulus and the measured read", () => {
    const { container } = render(<BroughtCardRenderer block={base} />);
    expect(container.textContent).toContain("You brought this");
    expect(container.textContent).toContain("Three years of footage");
    expect(container.textContent).toContain("Mixed");
    expect(container.textContent).toContain("4"); // the real fraction, once
    // Provenance in plain words — the model's internal name ("SIM-1 Flash") is jargon the
    // cards shed 2026-08-02; the line states that a simulation ran and how many reacted.
    expect(container.textContent).toContain("Simulated");
    expect(container.textContent).not.toContain("SIM-1 Flash");
    // No rank, no mechanism: nobody generated this, so there is nothing to claim on either.
    expect(container.textContent).not.toContain("Why it works");
    expect(container.textContent).not.toContain("#1");
  });

  it("states the count in the LENS's verb, not always 'stopped'", () => {
    const { container } = render(<BroughtCardRenderer block={withProps({ lens: "finish" })} />);
    expect(container.textContent).toContain("watched it through");
    expect(container.textContent).not.toContain("stopped");

    cleanup();
    const buy = render(<BroughtCardRenderer block={withProps({ lens: "buy" })} />);
    expect(buy.container.textContent).toContain("would act on it");
    expect(buy.container.textContent).not.toContain("stopped");
  });

  it("labels a sliced read with WHOSE number it is, and keeps the room's beside it", () => {
    render(
      <BroughtCardRenderer
        block={withProps({
          slice: { archetype: "niche_deep_buyer", label: "Craft nerds", honored: true, stopPct: 71, total: 410 },
        })}
      />,
    );
    const line = screen.getByTestId("brought-card-slice").textContent ?? "";
    expect(line).toContain("Craft nerds");
    expect(line).toContain("71%");
    expect(line).toContain("410");
    expect(line).toContain("whole audience"); // the fraction above is a DIFFERENT denominator
  });

  it("says a slice went UNANSWERED instead of showing the room's number under its name", () => {
    render(
      <BroughtCardRenderer
        block={withProps({
          slice: {
            archetype: "no_such_archetype",
            label: "Craft nerds",
            honored: false,
            reason: "this audience has no such slice",
          },
        })}
      />,
    );
    const line = screen.getByTestId("brought-card-slice").textContent ?? "";
    expect(line).toContain("not read");
    expect(line).toContain("this audience has no such slice");
    expect(line).toContain("different question");
    expect(line).not.toMatch(/\d+%/); // no percentage may be attached to the slice's name
  });

  it("shows no slice line at all on a whole-room run", () => {
    render(<BroughtCardRenderer block={base} />);
    expect(screen.queryByTestId("brought-card-slice")).toBeNull();
  });
});
