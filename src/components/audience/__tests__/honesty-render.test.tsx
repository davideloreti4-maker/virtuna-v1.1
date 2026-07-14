/** @vitest-environment happy-dom */
/**
 * Honesty-layer render lock for the audience surface.
 *
 * ORIGIN (Phase 3 Plan 05, D-05/D-06, TRUST-01/TRUST-02): this file locked the
 * AudienceCard's trust badge + persona-provenance affordances. The card was retired by
 * SPEC-2026-07-13 (audience redesign), so the assertions move to the surface that
 * replaced it — the honesty contract is stronger now, not weaker:
 *
 *  - The six-term badge vocabulary (Validated · Directional · Calibrated · Baseline ·
 *    Template · Limited data) is GONE from the audience surface. `resolveTier` reads only
 *    `audience.mode`, so it stamped "Validated" on an empty, never-calibrated audience —
 *    a truth-claim the data did not support. TrustBadge itself still ships (three thread
 *    blocks render it, where it describes the RUN's model tier), so its unit lock stays.
 *  - Provenance is now stated in words, in the "Built from" column: a scraped audience
 *    names its handle; a described one says no account data stands behind it; an empty one
 *    says "Nothing yet" instead of promising "receipts pending" from a branch that,
 *    in live data, never fires.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import type {
  Audience,
  AudienceSignature,
  SignaturePersona,
  CalibratedPersona,
} from "@/lib/audience/audience-types";
import { resolveTier } from "@/lib/audience/resolve-tier";
import { TrustBadge } from "../trust-badge";
import { AudienceIndex } from "../audience-index";
import { getBuiltFrom, getRung } from "../audience-display";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function baseAudience(overrides: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    user_id: "user-1",
    name: "Test Audience",
    type: "personal",
    mode: "socials",
    platform: "tiktok",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const EVIDENCE_QUOTE = "saves 2.1× the category baseline";

function signaturePersona(overrides: Partial<SignaturePersona> = {}): SignaturePersona {
  return {
    archetype: "high_engager",
    share: 1,
    temperature: "warm",
    disposition: "converter",
    reaction_frame: "Judges whether the payoff is worth the watch.",
    evidence: EVIDENCE_QUOTE,
    ...overrides,
  };
}

function signature(personas: SignaturePersona[]): AudienceSignature {
  return {
    creator_persona: {
      content_description: "",
      context: "",
      writing_style_sample: "",
      format_signature: "",
    },
    audience: {
      follower_tier: null,
      maturity: "growing",
      temperature_mix: { cold: 0.3, warm: 0.5, hot: 0.2 },
      interest_tags: [],
      what_resonates: "",
      what_falls_flat: "",
      persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
      personas,
    },
    summary: "",
    provenance: {
      handle: "zachking",
      scraped_at: "2026-06-20T12:00:00Z",
      videos_analyzed: 84,
      videos_watched: 8,
      sub_coverage: "6/8",
    },
  };
}

function calibratedPersona(overrides: Partial<CalibratedPersona> = {}): CalibratedPersona {
  return {
    archetype: "loyalist",
    repaint: "Hardcore gym regular who judges sloppy reps hard.",
    temperature: "warm",
    disposition: "collector",
    share: 1,
    ...overrides,
  };
}

function renderIndex(audiences: Audience[]) {
  return render(
    <AudienceIndex
      audiences={audiences}
      defaultAudienceId={null}
      onSetDefault={() => {}}
      onOpen={() => {}}
    />,
  );
}

// ─── TrustBadge still reads strictly from resolveTier (D-06 / T-03-11) ────────
// It ships in the thread blocks, where the tier describes the run's model — not here.

describe("TrustBadge tier reads strictly from resolveTier (D-06 / T-03-11)", () => {
  it("a mode='socials' audience renders a Validated badge", () => {
    render(<TrustBadge tier={resolveTier(baseAudience({ mode: "socials" }))} />);
    expect(screen.getByText("Validated")).toBeInTheDocument();
    expect(screen.queryByText("Directional")).toBeNull();
  });

  it("a mode='general' audience renders a Directional badge (never Validated)", () => {
    render(<TrustBadge tier={resolveTier(baseAudience({ mode: "general" }))} />);
    expect(screen.getByText("Directional")).toBeInTheDocument();
    expect(screen.queryByText("Validated")).toBeNull();
  });
});

// ─── The audience surface states provenance, and claims nothing else ──────────

describe("the index never stamps a trust claim on an audience", () => {
  it("renders no Validated / Directional / Calibrated badge on any row", () => {
    renderIndex([
      baseAudience({ id: "a", name: "Scraped", signature: signature([signaturePersona()]) }),
      baseAudience({ id: "b", name: "Empty" }),
      baseAudience({ id: "c", name: "General", is_general: true }),
    ]);

    for (const dead of ["Validated", "Directional", "Calibrated", "Needs calibration", "Baseline"]) {
      expect(screen.queryByText(dead)).toBeNull();
    }
  });

  it("an empty audience is never described as 'receipts pending'", () => {
    renderIndex([baseAudience({ name: "Empty" })]);
    expect(screen.queryByText("personas modeled · receipts pending")).toBeNull();
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});

describe("Built from states the real provenance (SPEC §4)", () => {
  it("a scraped audience names the handle it was read from", () => {
    const a = baseAudience({ signature: signature([signaturePersona()]) });
    expect(getBuiltFrom(a)).toMatchObject({
      label: "Read from @zachking",
      sub: "84 videos",
      needsAction: false,
    });
    expect(getRung(a)).toBe("read");

    renderIndex([a]);
    expect(screen.getByText("Read from @zachking")).toBeInTheDocument();
  });

  it("a signature with NO handle does not claim a scrape (the Marcus Reyes / Maya case)", () => {
    // The authored custom audiences carry a signature whose provenance handle is empty.
    // Keying off the signature alone rendered "Read from @" — an account-data claim with no
    // account behind it. The handle is the evidence; without it there is no reading.
    const authored = baseAudience({
      mode: "general",
      name: "Marcus Reyes",
      personas: [calibratedPersona()],
      signature: {
        ...signature([signaturePersona()]),
        provenance: {
          handle: "",
          scraped_at: "",
          videos_analyzed: 0,
          videos_watched: 0,
          sub_coverage: "",
        },
      },
    });

    expect(getBuiltFrom(authored).label).toBe("A description you wrote");
    expect(getBuiltFrom(authored).label).not.toContain("Read from");
    expect(getRung(authored)).toBe("described");
  });

  it("a described audience admits no account data stands behind it", () => {
    const a = baseAudience({
      personas: [calibratedPersona()],
      calibration: { source: "description" },
    });
    expect(getBuiltFrom(a)).toMatchObject({
      label: "A description you wrote",
      sub: "No account data behind it",
      needsAction: false,
    });
    // The honesty spine: a described audience has NOT been read, and must not claim it.
    expect(getRung(a)).toBe("described");

    renderIndex([a]);
    expect(screen.getByText("A description you wrote")).toBeInTheDocument();
    expect(screen.getByText("No account data behind it")).toBeInTheDocument();
  });

  it("an audience with nothing behind it says so, and is the only state that asks to act", () => {
    const a = baseAudience({ name: "test" });
    expect(getBuiltFrom(a)).toMatchObject({
      label: "Nothing yet",
      sub: "Read your @handle to fill it",
      needsAction: true,
    });

    renderIndex([a]);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build" })).toBeInTheDocument();
  });

  it("General is named as Maven's baseline, not as the user's own", () => {
    const a = baseAudience({ id: "general", name: "General", is_general: true });
    expect(getBuiltFrom(a)).toMatchObject({
      label: "Maven's baseline",
      sub: "Same for every user",
      needsAction: false,
    });

    renderIndex([a]);
    expect(screen.getByText("The control every Read is compared against")).toBeInTheDocument();
  });
});

describe("the default radio renders the audience that seeds new threads", () => {
  it("marks General as default when no audience is pinned (lastAudienceId === null)", () => {
    render(
      <AudienceIndex
        audiences={[
          baseAudience({ id: "general", name: "General", is_general: true }),
          baseAudience({ id: "mine", name: "Mine", personas: [calibratedPersona()] }),
        ]}
        defaultAudienceId={null}
        onSetDefault={() => {}}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByRole("radio", { name: "General seeds new threads" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Make Mine seed new threads" }),
    ).not.toBeChecked();
  });

  it("marks the pinned audience as default when one is set", () => {
    render(
      <AudienceIndex
        audiences={[
          baseAudience({ id: "general", name: "General", is_general: true }),
          baseAudience({ id: "mine", name: "Mine", personas: [calibratedPersona()] }),
        ]}
        defaultAudienceId="mine"
        onSetDefault={() => {}}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByRole("radio", { name: "Mine seeds new threads" })).toBeChecked();
  });
});
