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
// AudienceProfileView was retired by SPEC-2026-07-13; AudienceWorkspace is the surface that
// now carries the per-persona Edit affordance and the protected-baseline refusal.
import { AudienceWorkspace } from "../audience-workspace";

// The workspace navigates (next rung / delete → /audience); the retired profile view did not.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/** The workspace's props, minus the audience under test. */
function workspaceProps() {
  return { defaultAudienceId: null, onSetDefault: () => {}, onEditDetails: () => {} };
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

  it("a persona with no label displays the archetype-derived name (fallback)", () => {
    // `high_engager` (no label) → "High Engager" (underscore→space, title-case).
    const audience = calibratedAudience([
      persona({ archetype: "high_engager", label: undefined }),
    ]);

    render(<AudienceWorkspace audience={audience} {...workspaceProps()} />);

    // The archetype-derived name renders in the cast.
    expect(screen.getAllByText("High Engager").length).toBeGreaterThan(0);
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

  it("General/preset workspace shows NO Edit affordance + the protected-baseline caption", () => {
    const general = generalAudience();
    const { rerender } = render(<AudienceWorkspace audience={general} {...workspaceProps()} />);

    // No per-persona Edit affordance on General.
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    // The D-06 protected-baseline refusal is stated.
    expect(screen.getByText(/protected baseline/)).toBeInTheDocument();
    // The mix is rendered read-only — General's weights are the locked baseline.
    expect(screen.getByLabelText("New viewers")).toBeDisabled();

    // Same for a preset audience.
    rerender(<AudienceWorkspace audience={presetAudience()} {...workspaceProps()} />);
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.getByLabelText("New viewers")).toBeDisabled();
  });

  it("calibrated workspace DOES show an Edit affordance per persona + an editable mix", () => {
    const audience = calibratedAudience([persona({ archetype: "tough_crowd" })]);
    render(<AudienceWorkspace audience={audience} {...workspaceProps()} />);
    // The row-action is present (accessible name "Edit <display name>"). Named exactly:
    // the header also carries an "Edit details" button, which is a different affordance.
    expect(screen.getByRole("button", { name: "Edit Tough Crowd" })).toBeInTheDocument();
    // …and the read-only General caption is NOT shown for a calibrated audience.
    expect(screen.queryByText(/protected baseline/)).toBeNull();
    // The four engine dials are live (persona_weights → analysis_override).
    expect(screen.getByLabelText("New viewers")).toBeEnabled();
    expect(screen.getByLabelText("Loyalists")).toBeEnabled();
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
