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
import userEvent from "@testing-library/user-event";

import type { Audience } from "@/lib/audience/audience-types";
import { AudienceDetail, type AccountView, type SourceData } from "../audience-detail";

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
    // No room is claimed for an account with no audience behind it.
    expect(screen.queryByText(/The room/)).toBeNull();
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
    expect(screen.queryByText(/The room/)).toBeNull();
  });
});

// ─── The rework's two structural locks (2026-07-20) ──────────────────────────
//
// PopulationField's determinism suite died with the component — the 1,000-dot cloud
// was replaced by per-persona share bars. What replaces it here are locks on the two
// things the owner actually decided, both of which the OLD code fails:
// source-before-room (it was last), and no fold (it hid everything past six).

describe("the scrape leads the page", () => {
  it("renders SOURCE before THE ROOM in document order", () => {
    const { container } = render(
      <AudienceDetail
        audience={baseAudience()}
        account={account()}
        {...rest}
        source={source()}
      />,
    );
    const text = container.textContent ?? "";
    const sourceAt = text.indexOf("Source");
    const roomAt = text.indexOf("The room");
    expect(sourceAt).toBeGreaterThanOrEqual(0);
    expect(roomAt).toBeGreaterThanOrEqual(0);
    // You earn the room by showing what was read first.
    expect(sourceAt).toBeLessThan(roomAt);
  });

  it("states the videos the scrape analyzed, not the posts we happen to hold", () => {
    // listAllPosts caps the tiles; videos_analyzed is the stored provenance fact.
    const withProvenance = baseAudience({
      signature: {
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
          personas: [],
        },
        summary: "",
        provenance: {
          handle: "zachking",
          scraped_at: "2026-07-01T00:00:00Z",
          videos_analyzed: 84,
          videos_watched: 8,
          sub_coverage: "6/8",
        },
      },
    });
    render(
      <AudienceDetail
        audience={withProvenance}
        account={account()}
        {...rest}
        source={source()}
      />,
    );
    // Two post tiles are held; the scrape analyzed 84. The page must say 84.
    expect(screen.getByText(/84 videos analyzed/)).toBeInTheDocument();
    expect(screen.queryByText(/2 videos analyzed/)).toBeNull();
    // "read" overstated it: videos_analyzed counts metadata passes, and only a
    // subset (videos_watched) is actually watched through. The verb must not promise
    // the deeper operation.
    expect(screen.queryByText(/videos read/)).toBeNull();
  });
});

describe("the roster is ranked by share", () => {
  const unordered = baseAudience({
    personas: [
      {
        archetype: "tough_crowd",
        label: "Smallest",
        repaint: "The smallest slice of the room.",
        temperature: "cold",
        disposition: "skeptic",
        share: 0.2,
      },
      {
        archetype: "lurker",
        label: "Biggest",
        repaint: "The biggest slice of the room.",
        temperature: "warm",
        disposition: "lurker",
        share: 0.8,
      },
    ],
  });

  it("renders the largest share first, whatever order the column is in", () => {
    const { container } = render(
      <AudienceDetail audience={unordered} account={account()} {...rest} source={source()} />,
    );
    const text = container.textContent ?? "";
    expect(text.indexOf("Biggest")).toBeLessThan(text.indexOf("Smallest"));
  });

  it("Edit still targets the right persona after the display sort", async () => {
    // The regression this guards: sorting rows for display while indexing into the
    // UNSORTED `personas` column. Re-deriving editIndex after the sort opens the
    // dialog on the wrong person — silently, and with plausible-looking content.
    const user = userEvent.setup();
    render(
      <AudienceDetail audience={unordered} account={account()} {...rest} source={source()} />,
    );
    await user.click(screen.getByRole("button", { name: "Edit Biggest" }));
    expect(screen.getByDisplayValue("The biggest slice of the room.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("The smallest slice of the room.")).toBeNull();
  });
});

describe("the roster does not hide itself", () => {
  it("renders every persona — no fold, no 'N more…'", () => {
    const ten = baseAudience({
      personas: Array.from({ length: 10 }, (_, i) => ({
        archetype: "lurker" as const,
        label: `Persona ${i}`,
        repaint: `Description ${i}`,
        temperature: "warm" as const,
        disposition: "lurker" as const,
        share: 0.1,
      })),
    });
    render(<AudienceDetail audience={ten} account={account()} {...rest} source={source()} />);
    for (let i = 0; i < 10; i++) {
      expect(screen.getByText(`Persona ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/more…/)).toBeNull();
  });
});
