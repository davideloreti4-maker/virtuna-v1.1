/** @vitest-environment happy-dom */
/**
 * Phase 3 Plan 05 — honesty-layer render lock (D-05/D-06, TRUST-01/TRUST-02).
 *
 * UI-SPEC was `--skip-ui`'d for this phase, so there is NO downstream `/gsd-ui-phase`
 * to catch a honesty-render regression — the headline deliverable lands here. This is
 * the in-phase behavioral gate proving "honest at a glance":
 *  - the TrustBadge reads Validated for a mode='socials' audience and Directional for
 *    a mode='general' one — derived strictly from `resolveTier` (T-03-11 never-mis-badge);
 *  - a grounded persona (non-empty `evidence`) shows its quote inline on the card;
 *  - an evidence-free card renders the muted "no evidence — Directional" affordance and
 *    NOT an evidence quote;
 *  - a mode='general' authored template shows its "Authored template — Directional"
 *    provenance subline (POP-04), not the generic ungrounded line.
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
import { AudienceCard } from "../audience-card";

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
    reaction_frame: "Judges whether the hook earns the save.",
    evidence: EVIDENCE_QUOTE,
    ...overrides,
  };
}

function calibratedPersona(overrides: Partial<CalibratedPersona> = {}): CalibratedPersona {
  return {
    archetype: "tough_crowd",
    repaint: "Hard to convince. Needs proof.",
    temperature: "cold",
    disposition: "skeptic",
    share: 1,
    ...overrides,
  };
}

/** A signature carrying one evidence-bearing reactor → roster is grounded. */
function groundedSignature(): AudienceSignature {
  return {
    creator_persona: {
      content_description: "Short-form cooking tips",
      context: "Home cooks · casual · 30s recipes",
      writing_style_sample: "Here's the one thing nobody tells you about garlic.",
      format_signature: "Tight talking-head with on-screen text.",
    },
    audience: {
      follower_tier: "growing",
      maturity: "growing",
      temperature_mix: { cold: 0.2, warm: 0.5, hot: 0.3 },
      interest_tags: ["cooking"],
      what_resonates: "Quick, proof-first hooks.",
      what_falls_flat: "Slow intros.",
      persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
      personas: [signaturePersona()],
    },
    summary: "A growing cooking audience.",
    provenance: {
      handle: "cook",
      scraped_at: "2026-06-20T00:00:00.000Z",
      videos_analyzed: 8,
      videos_watched: 3,
      sub_coverage: "6/8",
    },
  };
}

// ─── Behavior (a): badge tier reads strictly from resolveTier(mode) ─────────────

describe("TrustBadge tier reads strictly from resolveTier (D-06 / T-03-11)", () => {
  it("a mode='socials' audience renders a Validated badge", () => {
    const socials = baseAudience({ mode: "socials" });
    render(<TrustBadge tier={resolveTier(socials)} />);
    expect(screen.getByText("Validated")).toBeInTheDocument();
    expect(screen.queryByText("Directional")).toBeNull();
  });

  it("a mode='general' audience renders a Directional badge (never Validated)", () => {
    const general = baseAudience({ mode: "general" });
    render(<TrustBadge tier={resolveTier(general)} />);
    expect(screen.getByText("Directional")).toBeInTheDocument();
    expect(screen.queryByText("Validated")).toBeNull();
  });
});

// ─── Behavior (b)/(c): persona provenance reads honestly on the card ────────────

describe("AudienceCard surfaces persona provenance honestly (D-05 / TRUST-02)", () => {
  it("mounts the tier badge in the card header", () => {
    render(<AudienceCard audience={baseAudience({ mode: "socials" })} />);
    // resolveTier(socials) → Validated badge rides alongside the status chip.
    expect(screen.getByText("Validated")).toBeInTheDocument();
  });

  it("a grounded persona shows its evidence quote inline", () => {
    const grounded = baseAudience({
      name: "Calibrated cooking audience",
      signature: groundedSignature(),
    });
    render(<AudienceCard audience={grounded} />);
    expect(screen.getByText(EVIDENCE_QUOTE)).toBeInTheDocument();
    // The muted ungrounded affordance is NOT shown when a persona is grounded.
    expect(screen.queryByText("no evidence — Directional")).toBeNull();
  });

  it("an evidence-free card shows the muted ungrounded affordance and NO quote", () => {
    const ungrounded = baseAudience({
      name: "Thin socials audience",
      mode: "socials",
      personas: [calibratedPersona()],
    });
    render(<AudienceCard audience={ungrounded} />);
    expect(screen.getByText("no evidence — Directional")).toBeInTheDocument();
    expect(screen.queryByText(EVIDENCE_QUOTE)).toBeNull();
  });

  it("a mode='general' authored template shows its provenance subline (POP-04)", () => {
    const template = baseAudience({
      id: "template-analyst",
      name: "Analyst",
      mode: "general",
      personas: [calibratedPersona()],
    });
    render(<AudienceCard audience={template} />);
    expect(screen.getByText("Authored template — Directional")).toBeInTheDocument();
    // The general-template provenance line replaces the generic ungrounded line.
    expect(screen.queryByText("no evidence — Directional")).toBeNull();
  });
});
