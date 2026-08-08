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

function installFetchMock() {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("/api/audiences")) body = { audiences: [SOCIALS_AUD] };
    else if (url.includes("/api/threads/new")) body = { threadId: "t-new" };
    else if (url.includes("/api/threads/open")) body = { threadId: "t1", messages: [] };
    else if (url.includes("/api/tracked-accounts")) body = { accounts: [] };
    else if (url.includes("/api/surfaces/drops/remix")) body = { threadId: "t-seeded" };
    else if (url.includes("/api/surfaces/drops"))
      body = { drops: [DROP_CARD, { ...DROP_CARD, contentId: "d2", hook: "Second drop" }] };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  }) as typeof fetch;
}

beforeEach(() => {
  cleanup();
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

  it("sub-bar present; left half opens the audience sheet", async () => {
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

  it("the sub-bar's Simulate door opens the report", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /open the simulation room/i }));
    expect(await screen.findByTestId("verdict-report")).toBeInTheDocument();
  });

  it("with nothing simulated, the report is honestly empty — no figure", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /open the simulation room/i }));
    expect(await screen.findByTestId("verdict-report")).toHaveTextContent(/nothing simulated yet/i);
    expect(screen.queryByTestId("report-verdict")).toBeNull();
  });

  it("a drop's meter opens the report on that drop's own cached read", async () => {
    renderWithClient(<Composer />);
    // Both fixture drops carry the same tally, so scope to the first card's own meter.
    fireEvent.click(await screen.findByTestId("drop-meter-d1"));
    expect(await screen.findByTestId("report-verdict")).toHaveTextContent("8/10");
  });

  it("opening a drop's report fires NO sim (fire-on-demand law)", async () => {
    renderWithClient(<Composer />);
    // Both fixture drops carry the same tally, so scope to the first card's own meter.
    fireEvent.click(await screen.findByTestId("drop-meter-d1"));
    await screen.findByTestId("report-verdict");
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/api/tools/react"))).toBe(false);
  });

  it("the v8 room overlay is gone — the report is the room now", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /open the simulation room/i }));
    await screen.findByTestId("verdict-report");
    expect(screen.queryByTestId("v8-room-overlay")).toBeNull();
  });

  it("mobile renders the report as a sheet (the harness matchMedia is <xl)", async () => {
    renderWithClient(<Composer />);
    // Both fixture drops carry the same tally, so scope to the first card's own meter.
    fireEvent.click(await screen.findByTestId("drop-meter-d1"));
    expect((await screen.findByTestId("verdict-report")).dataset.variant).toBe("sheet");
  });
});
