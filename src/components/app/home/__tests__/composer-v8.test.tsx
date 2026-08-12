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

  it("the room is the ATTACHED DOCK again <xl (owner ruling 2026-08-11); both retired v8 shapes are gone", async () => {
    renderWithClient(<Composer />);
    // The plate and the shipped attached bar are back ON the flag — v8 had taken the room
    // away twice (the sub-bar, then the in-composer room card) and the owner ruled it back.
    const slot = await screen.findByTestId("audience-header-slot");
    expect(within(slot).getByTestId("ambient-overview-sheet")).toBeInTheDocument();
    // Neither retired shape survives.
    expect(screen.queryByTestId("composer-sub-bar")).toBeNull();
    expect(screen.queryByTestId("composer-room-bar")).toBeNull();
  });

  it("the composer foot's audience chip opens the audience sheet", async () => {
    renderWithClient(<Composer />);
    // The lens moved off the deleted top bar and into the foot, beside the model selector.
    fireEvent.click(await screen.findByTestId("composer-audience-chip"));
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

  /**
   * The dock reserve (defect + fix, 2026-08-13). MEASURED in-browser at max scroll:
   *
   *   chat thread  393×852 → dock band 184px  ← `pb-[184px]` is exact
   *   chat thread 1440×900 → dock band 133px  ← already 51px generous
   *   v8 arrival   393×852 → dock band 238px  ← 54px SHORT: the sixth drop card ran under the
   *                                             band and the chips row bisected its Remix button
   *
   * The whole 54px is the chips row (mt-2.5 + 34 + mb-2.5), which renders nowhere else — so the
   * reserve moves with the chips instead of being bumped for every chat thread in the app. These
   * two assertions are the same boolean seen from both ends; if they ever disagree the overlap is
   * back, and no padding value announces which element it was measured against.
   */
  it("reserves for the chips row exactly where the chips row is", async () => {
    renderWithClient(<Composer />);
    await screen.findByTestId("composer-chips-row");
    const region = screen.getByTestId("composer-thread-region");
    expect(region.className).toContain("pb-[240px]");
    expect(region.className).not.toContain("pb-[184px]");
  });

  it("the arrival names the room above the fold, and it opens the room", async () => {
    // Owner ruling 2026-08-13. Before this the phone's first screen said nothing about the
    // audience — the dock's plate is 1,133px down and states the creator's handle, not the room.
    renderWithClient(<Composer />);
    const line = await screen.findByTestId("arrival-room-line");
    expect(line.textContent).toContain("1,000 viewers");
    // The SAME sheet the dock's plate opens — not a second surface.
    fireEvent.click(line);
    await waitFor(() => {
      expect(screen.queryByTestId("composer-chips-row")).toBeNull();
    });
    // …and with the chips gone the reserve follows them back down.
    expect(screen.getByTestId("composer-thread-region").className).toContain("pb-[184px]");
  });

  it("the shelf renders today's drops over the warm route, under its OWN label", async () => {
    renderWithClient(<Composer />);
    expect(await screen.findByTestId("drop-card-d1")).toBeInTheDocument();
    expect(screen.getByTestId("drop-card-d2")).toBeInTheDocument();
    // Owner rulings 2026-08-11 r4 + r5: the shelf carries ONE caption naming the drops'
    // provenance, and no heading at all — the greeting above is the arrival's only heading. The
    // greeting used to be REPLACED by a "Tonight's remixes" h1, which left the normal arrival
    // (drops present) with no welcome whatsoever.
    expect(screen.getByTestId("drop-shelf").textContent).toContain("Proven videos, rebuilt for your niche");
    expect(screen.getByTestId("drop-shelf").querySelector("h1, h2, h3")).toBeNull();
    expect(screen.getByTestId("arrival-v8").textContent).toMatch(/Welcome back|Good (morning|afternoon|evening)/);
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

  it("tapping the dock bar opens the SHIPPED room sheet — the in-composer room card is gone", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: "Open your audience" }));
    // The room is the pre-v8 sheet again: portaled to <body> (a transformed ancestor traps
    // position:fixed, which is why it was built that way in the first place).
    const panel = await screen.findByTestId("ambient-sheet-panel");
    expect(panel.parentElement).toBe(document.body);
    expect(screen.queryByTestId("composer-room-card")).toBeNull();
  });

  it("opening the room fires NO sim (fire-on-demand law)", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: "Open your audience" }));
    await screen.findByTestId("ambient-sheet-panel");
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
    // It spends exactly one run and lands in THE ROOM — the three-tab report the owner
    // rejected ("exactly what we didn't want") is deleted, so there is nowhere else to land.
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes("/api/tools/react"),
      );
      expect(calls).toHaveLength(1);
    });
    await screen.findByTestId("ambient-sheet-panel");
    expect(screen.queryByTestId("verdict-report")).toBeNull();
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
    const reactCalls = () =>
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes("/api/tools/react"),
      ).length;
    fireEvent.click(await screen.findByText(/simulate with your audience/i));
    await waitFor(() => expect(reactCalls()).toBe(1));
    await screen.findByTestId("ambient-sheet-panel");
    const before = reactCalls();
    fireEvent.keyDown(document, { key: "Escape" });
    // Re-opening the SAME card reads the session snapshot. (The door's own wording still says
    // "Simulate…": the seal lives in composer state, while the persisted block keeps
    // provenance:"projected" — a copy gap noted for the PR, not a re-fire.)
    fireEvent.click(screen.getByText(/simulate with your audience/i));
    await screen.findByTestId("ambient-sheet-panel");
    expect(reactCalls()).toBe(before);
  });
});
