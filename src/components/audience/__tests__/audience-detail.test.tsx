/** @vitest-environment happy-dom */
/**
 * AudienceDetail — the /audience/[id] surface (rebuild P2, sketch §3).
 *
 * Locks the page's facts per variant:
 *  - synced: @handle header + mono meta (platform · Primary · Synced), SOURCE zone
 *    renders ONLY what we hold (posts / figures / pillars), Sync + Danger rail with
 *    disconnect semantics;
 *  - described: description + notes as the source, NO account figures, no Sync card;
 *  - account-only: "Analytics only" — no room is claimed for an audience-less account;
 *  - General: read-only baseline, the 10-name cast, no Danger;
 *  - the empty shell says "Nothing yet" (the only state that earns colour).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { Audience } from "@/lib/audience/audience-types";
import { AudienceDetail, type AccountView, type SourceData } from "../audience-detail";
import { PopulationField } from "../population-field";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

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
    personas: [
      {
        archetype: "tough_crowd",
        repaint: "Frame-steps every trick looking for the cut.",
        temperature: "cold",
        disposition: "skeptic",
        share: 0.4,
      },
      {
        archetype: "lurker",
        repaint: "Watches the spectacle, never comments.",
        temperature: "warm",
        disposition: "lurker",
        share: 0.6,
      },
    ],
    profile: null,
    calibration: { source: "scrape", handle: "zachking" },
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function account(overrides: Partial<AccountView> = {}): AccountView {
  return {
    id: "acc-1",
    handle: "zachking",
    platform: "tiktok",
    is_primary: true,
    last_synced_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    ...overrides,
  };
}

function source(overrides: Partial<SourceData> = {}): SourceData {
  return {
    figures: [
      { label: "Followers", value: "86.1M" },
      { label: "Likes", value: "1.3B" },
      { label: "Posts", value: "610" },
    ],
    posts: [
      { id: "p1", caption: "Magic with a twist", views: 12_400_000 },
      { id: "p2", caption: "The jacket illusion", views: 8_100_000 },
    ],
    pillars: [{ name: "Visual Illusions & Magic", share: 0.3 }],
    ...overrides,
  };
}

const rest = { defaultAudienceId: null, pinnedThreads: 3, source: null };

// ─── Synced variant ───────────────────────────────────────────────────────────

describe("synced audience (account behind it)", () => {
  it("header is the @handle with the platform · Primary · Synced facts", () => {
    render(
      <AudienceDetail
        audience={baseAudience()}
        account={account()}
        {...rest}
        source={source()}
      />,
    );
    expect(screen.getByRole("heading", { name: "@zachking" })).toBeInTheDocument();
    expect(screen.getByText(/TikTok · Primary · Synced 2h ago/)).toBeInTheDocument();
  });

  it("SOURCE zone shows the posts, figures, and pillars we actually hold", () => {
    render(
      <AudienceDetail
        audience={baseAudience()}
        account={account()}
        {...rest}
        source={source()}
      />,
    );
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Magic with a twist")).toBeInTheDocument();
    expect(screen.getByText("86.1M")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Visual Illusions & Magic")).toBeInTheDocument();
  });

  it("the rail states usage + sync facts, and danger is a disconnect", () => {
    render(
      <AudienceDetail
        audience={baseAudience()}
        account={account()}
        {...rest}
        source={source()}
      />,
    );
    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("3 threads")).toBeInTheDocument();
    expect(screen.getByText("Sync")).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Re-calibrate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect @zachking" })).toBeInTheDocument();
    expect(screen.queryByText("Delete audience")).toBeNull();
  });

  it("the population hero states the honest provenance", () => {
    render(
      <AudienceDetail
        audience={baseAudience()}
        account={account()}
        {...rest}
        source={source()}
      />,
    );
    expect(screen.getByText(/1,000 viewers · 2 personas/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated from account data/i)).toBeInTheDocument();
  });
});

// ─── Described variant ────────────────────────────────────────────────────────

describe("described audience (no account)", () => {
  const described = baseAudience({
    name: "Fitness Creators",
    calibration: { source: "description" },
    goal_label: "Women 25–40 into home strength training.",
    custom_context: [{ source: "user", note: "They lift fasted before work." }],
  });

  it("the source is the description + notes — no account figures are claimed", () => {
    render(<AudienceDetail audience={described} account={null} {...rest} />);
    expect(screen.getByRole("heading", { name: "Fitness Creators" })).toBeInTheDocument();
    expect(screen.getByText(/From description/i)).toBeInTheDocument();
    expect(screen.getByText("Women 25–40 into home strength training.")).toBeInTheDocument();
    expect(screen.getByText("They lift fasted before work.")).toBeInTheDocument();
    expect(screen.queryByText("Followers")).toBeNull();
    expect(screen.queryByText("Sync")).toBeNull();
    expect(screen.getByText(/Generated from your description/i)).toBeInTheDocument();
  });

  it("danger is a plain delete", () => {
    render(<AudienceDetail audience={described} account={null} {...rest} />);
    expect(screen.getByRole("button", { name: "Delete audience" })).toBeInTheDocument();
  });
});

// ─── Account-only variant (analytics only) ───────────────────────────────────

describe("account-only (no audience behind it)", () => {
  it("claims no room — analytics only, source zone, disconnect", () => {
    render(
      <AudienceDetail
        audience={null}
        account={account({ platform: "instagram", is_primary: false })}
        {...rest}
        source={source({ figures: [{ label: "Followers", value: "24.5M" }], pillars: [] })}
      />,
    );
    expect(screen.getByText(/Instagram · Analytics only/)).toBeInTheDocument();
    expect(screen.getByText("No audience behind this account")).toBeInTheDocument();
    expect(screen.getByText("24.5M")).toBeInTheDocument();
    // No usage card (nothing to pin), no population field.
    expect(screen.queryByText("Usage")).toBeNull();
    expect(screen.queryByTestId("population-field")).toBeNull();
    expect(screen.getByRole("button", { name: "Disconnect @zachking" })).toBeInTheDocument();
  });
});

// ─── General ─────────────────────────────────────────────────────────────────

describe("General (the protected baseline)", () => {
  const general = baseAudience({
    id: "general",
    name: "General",
    is_general: true,
    personas: [],
    calibration: null,
  });

  it("renders the 10-name cast read-only — no edit, no danger, baseline facts", () => {
    render(<AudienceDetail audience={general} account={null} {...rest} />);
    // Header meta AND hero provenance both state the baseline fact.
    expect(screen.getAllByText(/Maven's baseline/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Maya")).toBeInTheDocument();
    expect(screen.getByText("Dev")).toBeInTheDocument();
    expect(screen.getByText(/1,000 viewers · 10 personas/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.queryByText("Danger")).toBeNull();
    expect(screen.queryByText("Edit details")).toBeNull();
  });
});

// ─── Empty shell ─────────────────────────────────────────────────────────────

describe("the empty shell", () => {
  it("says Nothing yet — the only state that earns colour", () => {
    render(
      <AudienceDetail
        audience={baseAudience({ personas: [], calibration: null })}
        account={null}
        {...rest}
      />,
    );
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build this audience" })).toBeInTheDocument();
    expect(screen.queryByTestId("population-field")).toBeNull();
  });
});

// ─── PopulationField determinism ─────────────────────────────────────────────

describe("PopulationField", () => {
  it("is deterministic — same shares + seed render byte-identical dots", () => {
    const shares = [0.4, 0.3, 0.2, 0.1];
    const a = render(
      <PopulationField shares={shares} provenance="Generated from account data" />,
    );
    const first = a.container.querySelector("svg")!.innerHTML;
    a.unmount();
    const b = render(
      <PopulationField shares={shares} provenance="Generated from account data" />,
    );
    expect(b.container.querySelector("svg")!.innerHTML).toBe(first);
  });

  it("renders ~1,000 dots split by share", () => {
    const { container } = render(
      <PopulationField shares={[0.5, 0.5]} provenance="Maven's baseline" />,
    );
    const dots = container.querySelectorAll("circle");
    expect(dots.length).toBe(1000);
  });
});
