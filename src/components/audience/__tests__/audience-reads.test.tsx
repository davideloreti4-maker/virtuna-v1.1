/** @vitest-environment happy-dom */
/**
 * AudienceReads — the honesty locks for the P2 rollup panels.
 *
 * These tests exist because of what the LIVE measurement found (scripts/measure-divergence.ts,
 * 2026-07-14, 10 concepts × 2 independent pairs against the scrape-calibrated "Zach King"):
 *
 *     bands moved on      1/10 Reads
 *     personas diverged   8/10 Reads   ← all 8 reproduced on an independent re-run
 *
 * The spec's original divergence design compared the two BANDS. It would have told the user
 * "your audience agrees with the generic crowd" on nine Reads out of ten, while their people were
 * plainly disagreeing underneath. So the load-bearing assertion in this file is the one that
 * locks the MIDDLE case: bands equal, people flipped. If a future edit collapses that back into
 * "agreed", the panel starts lying again and this test fails.
 *
 * The other two locks are the ones this subsystem has broken before:
 *  - an ABSENCE must never render as a FINDING ("nothing yet" ≠ "0 disagreements")
 *  - a FAILED fetch must never render as an absence ("couldn't load" ≠ "no Reads yet")
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";
import type { AudienceReadRollup } from "@/lib/audience/read-rollup";
import { AudienceReads } from "../audience-reads";

function persona(overrides: Partial<CalibratedPersona> = {}): CalibratedPersona {
  return {
    archetype: "tough_crowd",
    label: null,
    repaint: "Skeptical of the magic.",
    share: 0.1,
    temperature: "cold",
    disposition: "skeptical",
    ...overrides,
  } as CalibratedPersona;
}

function audience(overrides: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    user_id: "user-1",
    name: "Zach King",
    type: "personal",
    mode: "socials",
    platform: "tiktok",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [persona(), persona({ archetype: "niche_deep_buyer" })],
    profile: null,
    calibration: null,
    signature: null,
    custom_context: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  } as Audience;
}

function rollup(overrides: Partial<AudienceReadRollup> = {}): AudienceReadRollup {
  return {
    audienceId: "aud-1",
    reads: 0,
    personas: [],
    compared: 0,
    diverged: 0,
    personaDiverged: 0,
    cases: [],
    legacyUnattributed: 0,
    scanned: 12,
    scanCapped: false,
    ...overrides,
  };
}

function mockRollup(value: AudienceReadRollup) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rollup: value }),
    }),
  );
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("AudienceReads", () => {
  it("renders 'same verdict, different people' when the bands MATCH but personas flipped", async () => {
    // THE LOAD-BEARING CASE. Live 2026-07-14: "I froze a waterfall mid-air" landed Strong for
    // BOTH audiences while tough_crowd and niche_deep_buyer traded places. A band-only panel
    // calls this "agreed" and throws the real disagreement away.
    mockRollup(
      rollup({
        reads: 1,
        compared: 1,
        diverged: 0, // the BANDS agreed...
        personaDiverged: 1, // ...but the PEOPLE did not.
        cases: [
          {
            concept: "I froze a waterfall mid-air.",
            at: "2026-07-14T10:00:00Z",
            mine: { name: "Zach King", band: "Strong" },
            other: { name: "General", band: "Strong" },
            agreed: true,
            personaFlips: [{ archetype: "niche_deep_buyer", mine: "stop", other: "scroll" }],
          },
        ],
      }),
    );

    render(<AudienceReads audience={audience()} />);

    expect(await screen.findByText("same verdict, different people")).toBeTruthy();
    expect(screen.queryByText("agreed")).toBeNull();
    // The flip is named in the user's vocabulary, per person — not as a band delta.
    expect(
      screen.getByText(/stopped for you, but scrolled past for General/),
    ).toBeTruthy();
  });

  it("labels a case 'agreed' ONLY when no persona flipped", async () => {
    mockRollup(
      rollup({
        reads: 1,
        compared: 1,
        diverged: 0,
        personaDiverged: 0,
        cases: [
          {
            concept: "A one-take coffee pour.",
            at: "2026-07-14T10:00:00Z",
            mine: { name: "Zach King", band: "Strong" },
            other: { name: "General", band: "Strong" },
            agreed: true,
            personaFlips: [],
          },
        ],
      }),
    );

    render(<AudienceReads audience={audience()} />);

    expect(await screen.findByText("agreed")).toBeTruthy();
    expect(screen.getByText(/Everyone reacted the same way for both/)).toBeTruthy();
  });

  it("states an ABSENCE as an absence — never as a confident zero", async () => {
    mockRollup(rollup({ reads: 0, compared: 0, legacyUnattributed: 7 }));

    render(<AudienceReads audience={audience()} />);

    expect(await screen.findByText(/Nothing yet/)).toBeTruthy();
    // An empty rollup must not be dressed up as a finding about agreement.
    expect(screen.queryByText(/0 disagreements/i)).toBeNull();
    expect(screen.queryByText(/agreed/i)).toBeNull();
    // What was EXCLUDED is said out loud, not swallowed.
    expect(screen.getByText(/7 earlier Reads exist but predate per-audience attribution/)).toBeTruthy();
  });

  it("does NOT render the empty state when the fetch FAILED", async () => {
    // "Couldn't load" and "you have no Reads" are different claims. Collapsing them tells a
    // user with plenty of Reads that they have none.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    render(<AudienceReads audience={audience()} />);

    expect(await screen.findByText(/Couldn't load their reactions/)).toBeTruthy();
    expect(screen.queryByText(/Nothing yet/)).toBeNull();
  });

  it("refuses to promise a comparison for a custom audience (nothing to compare against)", async () => {
    mockRollup(rollup({ reads: 0, compared: 0 }));

    render(<AudienceReads audience={audience({ mode: "general", type: "target" })} />);

    expect(await screen.findByText(/judged on its own/)).toBeTruthy();
    expect(screen.queryByText(/Nothing compared yet/)).toBeNull();
  });

  it("renders each persona's own sentence under the name shown in the cast", async () => {
    mockRollup(
      rollup({
        reads: 2,
        personas: [
          {
            archetype: "niche_deep_buyer",
            verdict: "stop",
            quote: "A specific editing hack I can use later? Saved immediately.",
            at: "2026-07-14T10:00:00Z",
          },
        ],
      }),
    );

    render(<AudienceReads audience={audience()} />);

    await waitFor(() => expect(screen.getByText("Niche Deep Buyer")).toBeTruthy());
    expect(
      screen.getByText(/A specific editing hack I can use later\? Saved immediately\./),
    ).toBeTruthy();
    expect(screen.getByText("Stopped")).toBeTruthy();
  });
});
