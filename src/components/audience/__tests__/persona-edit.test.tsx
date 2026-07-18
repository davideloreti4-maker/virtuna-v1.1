/** @vitest-environment happy-dom */
/**
 * Phase 12 Plan 04 — persona editing (AUD-EDIT-01 / D-06).
 *
 * Locks the per-audience override write (incl. the new presentation-only `label`):
 *  - a calibrated edit PATCHes /api/audiences/<id> with the edited persona — `label` reflects
 *    the new Name, disposition/temperature/repaint reflect the edits, and `archetype` + `share`
 *    are byte-stable (no weight editing);
 *  - a persona with no `label` displays the archetype-derived name (fallback);
 *  - the form surfaces NO weight/share/distribution input;
 *  - General + preset audiences are refused (no editable form / no Edit affordance);
 *  - a failed PATCH surfaces the error copy.
 *
 * The General-baseline regression gates (persona-weights.test.ts + audience-regression-gate.test.ts)
 * are RE-RUN by this task's verify command (not from here) to prove the edit did not regress the
 * protected baseline — `label` is presentation-only and the engine never reads it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";

import type {
  Audience,
  CalibratedPersona,
} from "@/lib/audience/audience-types";
import { PersonaEditForm } from "../persona-edit-form";
// AudienceWorkspace was retired by the audience rebuild (P2, 2026-07-16); AudienceDetail is
// the surface that now carries the per-persona Edit affordance and the read-only refusal.
import { AudienceDetail } from "../audience-detail";

// The detail page navigates (edit / delete → /audience); mock the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

/** The detail page's props, minus the audience under test. */
function detailProps() {
  return { account: null, defaultAudienceId: null, pinnedThreads: 0, source: null };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function persona(overrides: Partial<CalibratedPersona> = {}): CalibratedPersona {
  return {
    archetype: "tough_crowd",
    repaint: "Hard to convince. Needs proof before trusting a claim.",
    temperature: "cold",
    disposition: "skeptic",
    share: 0.25,
    ...overrides,
  };
}

function calibratedAudience(personas: CalibratedPersona[]): Audience {
  return {
    id: "aud-calibrated-1",
    user_id: "user-1",
    name: "My TikTok Audience",
    type: "personal",
    mode: "socials",
    platform: "tiktok",
    goal_label: "Grow my following",
    goal_intent: "grow",
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas,
    profile: null,
    calibration: { source: "scrape", handle: "me" },
    created_at: "2026-06-20T00:00:00.000Z",
    updated_at: "2026-06-20T00:00:00.000Z",
  };
}

function generalAudience(): Audience {
  return {
    ...calibratedAudience([persona()]),
    id: "general",
    name: "General",
    is_general: true,
  };
}

function presetAudience(): Audience {
  return {
    ...calibratedAudience([persona()]),
    id: "preset-growth",
    name: "Growth",
    is_preset: true,
  };
}

/** A successful PATCH echoes back the audience the route persisted. */
function okResponse(audience: Audience) {
  return { ok: true, json: () => Promise.resolve({ audience }) };
}

describe("Persona editing (AUD-EDIT-01 / D-06)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calibrated edit PATCHes the personas override — label=Name, archetype+share byte-stable", async () => {
    const p0 = persona({ archetype: "tough_crowd", share: 0.4, disposition: "skeptic" });
    const audience = calibratedAudience([p0, persona({ archetype: "loyalist", share: 0.6 })]);

    const fetchMock = vi.fn().mockResolvedValue(okResponse(audience));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonaEditForm
        audience={audience}
        persona={p0}
        index={0}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    // Edit the Name (→ label) and the Description (→ repaint).
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Hard-to-convince Hannah" } });

    const descInput = screen.getByLabelText("Description");
    fireEvent.change(descInput, { target: { value: "Needs three proofs, not one." } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/audiences/aud-calibrated-1");
    expect((init as RequestInit).method).toBe("PATCH");

    const body = JSON.parse((init as RequestInit).body as string) as {
      personas: CalibratedPersona[];
    };

    // The edited persona (index 0): label = new Name, repaint = new Description.
    const edited = body.personas[0]!;
    expect(edited.label).toBe("Hard-to-convince Hannah");
    expect(edited.repaint).toBe("Needs three proofs, not one.");

    // archetype + share are byte-stable (no weight editing — D-06).
    expect(edited.archetype).toBe("tough_crowd");
    expect(edited.share).toBe(0.4);

    // The OTHER persona is untouched.
    expect(body.personas[1]!.archetype).toBe("loyalist");
    expect(body.personas[1]!.share).toBe(0.6);

    // Success copy.
    expect(
      screen.getByText("Persona updated. Future threads use the edited audience."),
    ).toBeInTheDocument();
  });

  it("a persona with no label displays the stable cast name (fallback)", () => {
    // `high_engager` (no label) → "Maya" — the recurring-cast name every surface uses
    // (persona-names is the naming SSOT; the manager must call the same person the
    // same thing the room does).
    const audience = calibratedAudience([
      persona({ archetype: "high_engager", label: undefined }),
    ]);

    render(<AudienceDetail audience={audience} {...detailProps()} />);

    expect(screen.getAllByText("Maya").length).toBeGreaterThan(0);
  });

  it("the edit form surfaces NO weight / share / distribution input", () => {
    const audience = calibratedAudience([persona()]);
    const { container } = render(
      <PersonaEditForm
        audience={audience}
        persona={audience.personas[0]!}
        index={0}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    // Exactly the four D-06 fields are present. Name + Description are <input>/<textarea>
    // (label-associated); Disposition + Temperature are Select comboboxes with a visible label.
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByText("Disposition")).toBeInTheDocument();
    expect(screen.getByText("Temperature")).toBeInTheDocument();
    // Two Select comboboxes (Disposition + Temperature).
    expect(screen.getAllByRole("combobox")).toHaveLength(2);

    // No weight/share/distribution control by accessible name…
    expect(screen.queryByLabelText(/weight|share|distribution/i)).toBeNull();
    // …and no such labels appear anywhere in the form text.
    expect(within(container).queryByText(/weight|share|distribution/i)).toBeNull();
  });

  it("General is refused: PersonaEditForm renders nothing", () => {
    const general = generalAudience();
    const { container } = render(
      <PersonaEditForm
        audience={general}
        persona={general.personas[0]!}
        index={0}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    // Structural refusal — no form, no heading.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Edit persona")).toBeNull();
  });

  it("General/preset detail shows NO Edit affordance (read-only rooms)", () => {
    const general = generalAudience();
    const { rerender } = render(<AudienceDetail audience={general} {...detailProps()} />);

    // No per-persona Edit affordance on General — and no Danger card either.
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.queryByText("Delete audience")).toBeNull();

    // Same for a preset audience.
    rerender(<AudienceDetail audience={presetAudience()} {...detailProps()} />);
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.queryByText("Delete audience")).toBeNull();
  });

  it("calibrated detail DOES show an Edit affordance per persona — no mix sliders anywhere", () => {
    const audience = calibratedAudience([persona({ archetype: "tough_crowd" })]);
    const { container } = render(<AudienceDetail audience={audience} {...detailProps()} />);
    // The row-action is present (accessible name "Edit <cast name>": tough_crowd → Dev).
    expect(screen.getByRole("button", { name: "Edit Dev" })).toBeInTheDocument();
    // The mix sliders died with the workspace — the engine's dials stay baked.
    expect(container.querySelector('input[type="range"]')).toBeNull();
  });

  it("a failed PATCH surfaces the error copy", async () => {
    const audience = calibratedAudience([persona()]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PersonaEditForm
        audience={audience}
        persona={audience.personas[0]!}
        index={0}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await Promise.resolve();
    });

    expect(screen.getByText("Couldn't save this persona. Try again.")).toBeInTheDocument();
  });
});

// ─── Persona receipts (2026-07-14) ──────────────────────────────────────────────
//
// `evidence` is the engagement pattern in the SCRAPE that put a persona in the room. It lives
// ONLY on the frozen `signature` reactors — the editable `personas` column has no such field.
// So a receipt may appear iff a real scrape produced one. `isPersonaGrounded` was written for
// exactly this and sat with ZERO callers until today, because until the first real calibration
// ran (@zachking) no audience in prod had any evidence to show.
//
// The honesty claim lives in the ASYMMETRY, so both directions are asserted.

/** A scrape-backed audience: signature reactors carry the receipts, keyed by archetype. */
function scrapedAudience(): Audience {
  const base = calibratedAudience([
    persona({ archetype: "tough_crowd", repaint: "Debunks the illusion.", share: 0.5 }),
    persona({ archetype: "loyalist", repaint: "Watches everything.", share: 0.5 }),
  ]);
  return {
    ...base,
    signature: {
      creator_persona: {
        content_description: "",
        context: "",
        writing_style_sample: "",
        format_signature: "",
      },
      audience: {
        follower_tier: "mega",
        maturity: "established",
        temperature_mix: { cold: 0.4, warm: 0.4, hot: 0.2 },
        interest_tags: [],
        what_resonates: "",
        what_falls_flat: "",
        persona_weights: base.persona_weights,
        personas: [
          {
            archetype: "tough_crowd",
            share: 0.5,
            temperature: "cold",
            disposition: "skeptic",
            reaction_frame: "Debunks the illusion.",
            evidence: "Low comment-to-view ratios on standard tricks.",
          },
          {
            archetype: "loyalist",
            share: 0.5,
            temperature: "hot",
            disposition: "connector",
            reaction_frame: "Watches everything.",
            evidence: "", // the scrape found no receipt for this one — claim nothing
          },
        ],
      },
      summary: "",
      provenance: {
        handle: "zachking",
        scraped_at: "2026-07-14T00:00:00.000Z",
        videos_analyzed: 12,
        videos_watched: 5,
        sub_coverage: "8/12",
      },
    },
  } as Audience;
}

describe("Persona receipts — shown iff the scrape actually produced one", () => {
  it("renders the engagement receipt under a grounded persona", () => {
    render(<AudienceDetail audience={scrapedAudience()} {...detailProps()} />);
    expect(
      screen.getByText(/Low comment-to-view ratios on standard tricks\./),
    ).toBeInTheDocument();
  });

  it("claims NOTHING for a persona whose evidence is empty (no fabricated receipt)", () => {
    const { container } = render(
      <AudienceDetail audience={scrapedAudience()} {...detailProps()} />,
    );
    // Two personas, but only ONE carries evidence — so exactly one receipt may render.
    const receipts = within(container).getAllByText(/^Evidence ·/);
    expect(receipts).toHaveLength(1);
  });

  it("a DESCRIBED audience (no signature) shows no receipts at all", () => {
    const described = calibratedAudience([persona(), persona({ archetype: "loyalist" })]);
    const { container } = render(
      <AudienceDetail audience={described} {...detailProps()} />,
    );
    expect(within(container).queryAllByText(/^Evidence ·/)).toHaveLength(0);
    expect(screen.queryByText(/Evidence is the engagement pattern/)).not.toBeInTheDocument();
  });
});
