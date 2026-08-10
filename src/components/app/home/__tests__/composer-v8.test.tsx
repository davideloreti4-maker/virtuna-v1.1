/** @vitest-environment happy-dom */
/**
 * Composer v8 integration (CONCEPT_V8_ENABLED + AMBIENT_V2_ENABLED both on).
 *
 * London-style, same harness as composer.test.tsx: streams/profile/navigation/motion
 * mocked, fetch routed to inert JSON. Asserts the v8 anatomy — skill pill + panel,
 * always-visible model chip with the real Max price, attached sub-bar + audience
 * sheet, chips row, and the AmbientStartHome arrival retired for the v8 greeting.
 * Flag-off behavior is covered by the whole EXISTING suite (default env = both off).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/flags/concept-v8", () => ({ CONCEPT_V8_ENABLED: true }));

const start = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/queries/use-analysis-stream", () => ({
  useAnalysisStream: () => ({
    start,
    analysisId: null,
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase: "idle",
    error: null,
    reconnect: vi.fn(),
    filmstrips: {},
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/queries/use-profile", () => ({
  useProfile: () => ({ data: { name: "Davide" }, isLoading: false }),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/home",
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => true,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
    },
    storage: {
      from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }),
    },
  }),
}));

import { Composer } from "../composer";
import { CREDIT_COSTS } from "@/lib/pricing";
import { dropCardToRemixBlocks } from "@/lib/surfaces/drop-seed";

// A socials audience so the skills panel renders the creator registry.
const SOCIALS_AUD = {
  id: "aud-1",
  name: "Your people",
  mode: "socials",
  is_general: false,
  is_preset: false,
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  personas: [],
  source_account_id: "acct-1",
};

// A drop card as the warm route returns it (Phase 2 — the shelf).
const DROP_CARD = {
  contentId: "d1",
  hook: "Adapted drop hook",
  coverUrl: "https://x.supabase.co/storage/v1/object/public/covers/c.jpg",
  videoUrl: "https://tiktok.example/v/1",
  views: "8.1M",
  viewsRaw: 8_100_000,
  handle: "creator",
  archetype: null,
  hookTemplate: null,
  concepts: [],
  // Ten REAL personas so the meter carries a real tally and the report has voices to print.
  personas: Array.from({ length: 10 }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < 8 ? ("stop" as const) : ("scroll" as const),
    quote: i < 8 ? `stopped ${i}` : `scrolled ${i}`,
  })),
};

/** One valid AdaptConcept — dropCardToRemixBlocks safeParses, so an invalid one yields []. */
const ADAPT_CONCEPT = {
  hook: "I sit 10 hours a day. Stretching didn't fix me — this did.",
  angle: "open-loop confession, then the mechanism",
  who_its_for: "desk workers with a stiff back",
  format_borrowed: "open-loop cold open",
  personaStops: 6,
  // REQUIRED in practice: drop-seed writes `scrollQuote: stopQuote ?? ""` and the block schema
  // demands >=1 char, so a concept without one is silently dropped (see the PR note).
  stopQuote: "ok that's me. fine.",
};

/** A thread carrying the SAME remix-card stack the Phase-2 seed route writes. Built by the real
 *  pure producer — never hand-authored props, which would drift from the block schema. */
function seededThread() {
  return {
    threadId: "t1",
    messages: [
      {
        id: "m1",
        thread_id: "t1",
        role: "assistant" as const,
        blocks: dropCardToRemixBlocks({ ...DROP_CARD, concepts: [ADAPT_CONCEPT] }, "Your people"),
        created_at: "2026-08-09T00:00:00.000Z",
      },
    ],
    simSeals: {},
  };
}

/** The /api/threads/open body. Tests that need a card in the thread set this to seededThread(). */
let threadFixture: unknown = { threadId: "t1", messages: [] };

function installFetchMock() {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("/api/audiences")) body = { audiences: [SOCIALS_AUD] };
    else if (url.includes("/api/threads/new")) body = { threadId: "t-new" };
    else if (url.includes("/api/threads/open")) body = threadFixture;
    else if (url.includes("/api/tracked-accounts")) body = { accounts: [] };
    // A thread with cards mounts SaveAffordance → useSavedItems; the hook reads `data.items`.
    else if (url.includes("/api/saved")) body = { items: [] };
    else if (url.includes("/api/surfaces/drops/remix")) body = { threadId: "t-seeded" };
    else if (url.includes("/api/surfaces/drops"))
      body = { drops: [DROP_CARD, { ...DROP_CARD, contentId: "d2", hook: "Second drop" }] };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  }) as typeof fetch;
}

beforeEach(() => {
  cleanup();
  threadFixture = { threadId: "t1", messages: [] };
  installFetchMock();
  // ≥640px (the desktop skills panel) but <1280px (no rail portal).
  window.matchMedia = ((q: string) => {
    const m = /min-width:\s*(\d+)/.exec(q);
    return {
      matches: m ? Number(m[1]) <= 1024 : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("composer v8 (flag on)", () => {
  it("foot: skill pill present, model selector visible on all widths", async () => {
    renderWithClient(<Composer />);
    expect(await screen.findByTestId("composer-skill-pill")).toBeInTheDocument();
    const chip = screen.getByTestId("sim-model-selector");
    expect(chip.parentElement?.className ?? "").not.toContain("hidden");
  });

  it("skill pill opens the skills panel; Use arms the skill as a field tag", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByTestId("composer-skill-pill"));
    const panel = screen.getByTestId("skills-panel");
    expect(panel).toBeInTheDocument();
    // Scoped: the Phase-2 shelf renders its own "Remix" buttons outside the panel.
    fireEvent.click(within(panel).getByText("Remix"));
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    await waitFor(() => {
      expect(screen.getByTestId("composer-armed-skill")).toHaveAttribute("data-skill", "remix");
    });
  });

  it("arming the Max Test puts the real price on the model chip", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByTestId("composer-skill-pill"));
    fireEvent.click(screen.getByText("A real video"));
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    await waitFor(() => {
      expect(screen.getByTestId("sim-model-selector").textContent).toContain(
        `${CREDIT_COSTS.score} cr`,
      );
    });
  });

  it("the composer's TOP bar is the room's door (owner ruling 2026-08-10) — the legacy header slot still never mounts", async () => {
    renderWithClient(<Composer />);
    // The v8 top bar (the old mobile-dock anatomy) is mounted above the field…
    await screen.findByTestId("composer-room-bar");
    // …the retired sub-bar is gone…
    expect(screen.queryByTestId("composer-sub-bar")).toBeNull();
    // …and the LEGACY pre-v8 header slot still never mounts flag-on.
    expect(screen.queryByTestId("audience-header-slot")).toBeNull();
  });

  it("the bar's lens zone opens the audience sheet", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Choose audience and platform" }),
    );
    expect(screen.getByTestId("audience-sheet")).toBeInTheDocument();
  });

  it("typing / opens the portaled slash menu (the in-place one is clipped invisible)", async () => {
    renderWithClient(<Composer />);
    const field = (await screen.findAllByRole("textbox"))[0]!;
    fireEvent.change(field, { target: { value: "/te" } });
    const menu = await screen.findByRole("menu", { name: "Skills" });
    // Portaled to <body>, not nested in the overflow-hidden composer box.
    expect(menu.parentElement).toBe(document.body);
  });

  it("the arrival is the v8 greeting — the Start grid and starter are gone", async () => {
    renderWithClient(<Composer />);
    expect(await screen.findByTestId("arrival-v8")).toBeInTheDocument();
    expect(screen.queryByTestId("ambient-start-sim-door")).toBeNull();
    expect(screen.getByTestId("composer-chips-row")).toBeInTheDocument();
  });

  it("the shelf renders today's drops over the warm route; the greeting flips to the shelf headline", async () => {
    renderWithClient(<Composer />);
    expect(await screen.findByTestId("drop-card-d1")).toBeInTheDocument();
    expect(screen.getByTestId("drop-card-d2")).toBeInTheDocument();
    expect(screen.getByTestId("arrival-v8").textContent).toContain("Tonight's remixes");
  });

  it("Remix on a drop seeds the thread: POSTs the seed route, points the cookie at it", async () => {
    renderWithClient(<Composer />);
    const cardEl = await screen.findByTestId("drop-card-d1");
    fireEvent.click(within(cardEl).getByRole("button", { name: /remix/i }));
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const seed = calls.find(([u]) => String(u).includes("/api/surfaces/drops/remix"));
      expect(seed).toBeDefined();
      expect(String((seed![1] as RequestInit).body)).toContain('"contentId":"d1"');
    });
    await waitFor(() => {
      expect(document.cookie).toContain("maven_active_thread=t-seeded");
    });
  });

  it("drop cards are UNSCORED (owner ruling 2026-08-10): no meter, no /10, no report door", async () => {
    renderWithClient(<Composer />);
    await screen.findByTestId("drop-card-d1");
    expect(screen.queryByTestId("drop-meter-d1")).toBeNull();
    expect(within(screen.getByTestId("drop-shelf")).queryByText(/\/10/)).toBeNull();
  });

  it("tapping the bar opens the sim room IN the composer — a card, not a page/overlay", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByTestId("composer-room-bar"));
    const room = await screen.findByTestId("composer-room-card");
    // In flow inside the composer box (the composer opens up into a card) —
    // never portaled to <body> like the old full-screen sheet.
    expect(room.closest('[data-testid="composer-room"]')).not.toBeNull();
    expect(room.parentElement?.closest("body > [data-testid]")).toBeNull();
  });

  it("opening the room fires NO sim (fire-on-demand law)", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByTestId("composer-room-bar"));
    await screen.findByTestId("composer-room-card");
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/api/tools/react"))).toBe(false);
  });

  it("an UNSIMULATED card's door fires the sim and shows the sealed watcher", async () => {
    threadFixture = seededThread();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown = {};
      if (url.includes("/api/tools/react"))
        body = {
          fraction: "6/10 stop",
          personas: Array.from({ length: 10 }, (_, i) => ({
            archetype: `a${i}`,
            verdict: i < 6 ? "stop" : "scroll",
            quote: `v${i}`,
          })),
          population: null,
        };
      else if (url.includes("/api/audiences")) body = { audiences: [SOCIALS_AUD] };
      else if (url.includes("/api/threads/open")) body = threadFixture;
      else if (url.includes("/api/tracked-accounts")) body = { accounts: [] };
      else if (url.includes("/api/saved")) body = { items: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    });

    renderWithClient(<Composer />);
    // The row's accessible name is the card's label; the door text is what a creator taps.
    fireEvent.click(await screen.findByText(/simulate with your audience/i));
    await waitFor(() => expect(screen.getByTestId("report-verdict")).toHaveTextContent("6/10"));
  });

  it("a second tap while watching does NOT fire a second billed call", async () => {
    threadFixture = seededThread();
    renderWithClient(<Composer />);
    const door = await screen.findByText(/simulate with your audience/i);
    fireEvent.click(door);
    fireEvent.click(door);
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes("/api/tools/react"),
      );
      expect(calls).toHaveLength(1);
    });
  });

  it("an ALREADY-simulated card re-opens its snapshot without firing again", async () => {
    threadFixture = seededThread();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown = {};
      if (url.includes("/api/tools/react"))
        body = {
          fraction: "6/10 stop",
          personas: Array.from({ length: 10 }, (_, i) => ({
            archetype: `a${i}`,
            verdict: i < 6 ? "stop" : "scroll",
            quote: `v${i}`,
          })),
          population: null,
        };
      else if (url.includes("/api/audiences")) body = { audiences: [SOCIALS_AUD] };
      else if (url.includes("/api/threads/open")) body = threadFixture;
      else if (url.includes("/api/tracked-accounts")) body = { accounts: [] };
      else if (url.includes("/api/saved")) body = { items: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    });

    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByText(/simulate with your audience/i));
    await waitFor(() => expect(screen.getByTestId("report-verdict")).toHaveTextContent("6/10"));
    const reactCalls = () =>
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes("/api/tools/react"),
      ).length;
    const before = reactCalls();
    fireEvent.keyDown(document, { key: "Escape" });
    // Re-opening the SAME card reads the session snapshot. (The door's own wording still says
    // "Simulate…": the seal lives in composer state, while the persisted block keeps
    // provenance:"projected" — a copy gap noted for the PR, not a re-fire.)
    fireEvent.click(screen.getByText(/simulate with your audience/i));
    await screen.findByTestId("report-verdict");
    expect(reactCalls()).toBe(before);
  });
});
