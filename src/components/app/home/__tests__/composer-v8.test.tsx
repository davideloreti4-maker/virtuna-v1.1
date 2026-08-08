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
import { screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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

function installFetchMock() {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("/api/audiences")) body = { audiences: [SOCIALS_AUD] };
    else if (url.includes("/api/threads/new")) body = { threadId: "t-new" };
    else if (url.includes("/api/threads/open")) body = { threadId: "t1", messages: [] };
    else if (url.includes("/api/tracked-accounts")) body = { accounts: [] };
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
    expect(screen.getByTestId("skills-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Remix"));
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

  it("the arrival is the v8 greeting — the Start grid and starter are gone", async () => {
    renderWithClient(<Composer />);
    expect(await screen.findByTestId("arrival-v8")).toBeInTheDocument();
    expect(screen.queryByTestId("ambient-start-sim-door")).toBeNull();
    expect(screen.getByTestId("composer-chips-row")).toBeInTheDocument();
  });
});
