/** @vitest-environment happy-dom */
/**
 * "After posting" on the two result pages (plan 2026-11-24-after-posting, Task 3, "Mounting"): directly
 * under the page's first block, the card when the piece has a posted link, else the quiet "Posted it?"
 * row; nothing while the result loads, when it is not there, or when it has no number. Real: the
 * screens, their queries, the result views, the posted parts and hooks, TanStack Query. Stand-ins: the
 * network (`fetch`), the router, the window's width, ResizeObserver, the clock and the build-time flag.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// The (app) layout's toast provider: the posted link's remove reports a refusal there.
import { ToastProvider } from "@/components/ui/toast";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/simulation/x" }));

import { NOW, posted } from "@/components/posted-next/__tests__/posted-fixtures";
import { HOOK_1_POPULATION, MEAL_PREP_HOOKS } from "@/components/thread-next/__tests__/fixtures/answers";
import early from "@/lib/result/__tests__/fixtures/early.json";
import noAudience from "@/lib/result/__tests__/fixtures/no-audience.json";
import type { Posted } from "@/lib/posted/posted";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import { SimulationScreen } from "../simulation-screen";
import { TextResultScreen } from "../text-result-screen";

const THREAD = "00000000-0000-4000-8000-0000000000bb";
const HOOK = MEAL_PREP_HOOKS[0]!.props.hookLine;
let KEY = "";
beforeAll(async () => {
  KEY = await sealHashOf(HOOK);
});

class FakeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target, contentRect: { width: 588, height: 400 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const setWidth = (value: number) => Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });
const realWidth = window.innerWidth;

/** What the routes answer; `null` holds that answer back (still loading). */
const answers = {
  seal: (): Response | null => json({ text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true }),
  analysis: (): Response | null => json(early),
  posted: null as Posted | null,
};

let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;
const postedAsks = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith("/api/posted"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  // No retries: a refused row is "not here" at once (the app's default retries three times).
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  answers.seal = () => json({ text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
  answers.analysis = () => json(early);
  answers.posted = null;
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hold = () => new Promise<Response>(() => {});
    if (url.startsWith(`/api/threads/${THREAD}/seals/`)) return answers.seal() ?? hold();
    if (url.startsWith("/api/analysis/")) return answers.analysis() ?? hold();
    if (url.startsWith("/api/videos/sign")) return json({ url: "https://videos.test/clip.mp4" });
    if (url.startsWith("/api/posted?")) return json({ posted: answers.posted });
    return json({ error: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  client.clear();
  setWidth(realWidth);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderText = () =>
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <TextResultScreen threadId={THREAD} sealKey={KEY} as="hook" />
      </ToastProvider>
    </QueryClientProvider>,
  );
const renderVideo = (id = "fixture-early") =>
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SimulationScreen id={id} />
      </ToastProvider>
    </QueryClientProvider>,
  );

const askRow = () => document.querySelector<HTMLElement>("[data-posted-ask]");
const afterCard = () => document.querySelector<HTMLElement>("[data-after-posting]");

describe("the hook's page (/simulation/hook/[threadId]/[key])", () => {
  it("asks for this piece's link, and puts the quiet row directly under the first block, before the ring", async () => {
    renderText();
    await waitFor(() => expect(askRow()).not.toBeNull());
    const hero = document.querySelector('[data-text-result="hero"]')!;
    expect(hero.nextElementSibling).toBe(askRow());
    expect(askRow()!.nextElementSibling).toBe(document.querySelector('[data-text-result="ring"]'));
    expect(postedAsks()).toEqual([`/api/posted?threadId=${THREAD}&key=${KEY}`]);
  });

  it("a posted piece: the card in that place", async () => {
    answers.posted = posted();
    renderText();
    await waitFor(() => expect(afterCard()).not.toBeNull());
    expect(document.querySelector('[data-text-result="hero"]')!.nextElementSibling).toBe(afterCard());
    expect(askRow()).toBeNull();
  });

  it("a result with no known group (one card): the row under it", async () => {
    answers.seal = () =>
      json({ text: HOOK, at: "2026-11-21T00:00:00.000Z", population: { ...HOOK_1_POPULATION, segments: HOOK_1_POPULATION.segments.map((s) => ({ ...s, archetype: "unknown-group" })) }, open: true });
    renderText();
    await waitFor(() => expect(askRow()).not.toBeNull());
    expect(document.querySelector('[data-text-result="ring"]')).toBeNull();
    expect(document.querySelector('[data-text-result="hero"]')!.nextElementSibling).toBe(askRow());
  });

  it("while the result loads: nothing, and the link is not asked for", async () => {
    answers.seal = () => null;
    renderText();
    await act(async () => {});
    expect(document.querySelector('[data-text-result="loading"]')).not.toBeNull();
    expect(askRow()).toBeNull();
    expect(postedAsks()).toEqual([]);
  });

  it("not here (or no number): nothing, and the link is not asked for", async () => {
    answers.seal = () => json({ error: "Not found" }, 404);
    renderText();
    expect(await screen.findByText("This simulation isn't here.")).toBeInTheDocument();
    await act(async () => {});
    expect(askRow()).toBeNull();
    expect(postedAsks()).toEqual([]);
  });

  it("a seal with no number: nothing", async () => {
    answers.seal = () => json({ text: HOOK, at: "2026-11-21T00:00:00.000Z", population: { total: 1000, segments: [], reasons: [] }, open: true });
    renderText();
    expect(await screen.findByText("This simulation isn't here.")).toBeInTheDocument();
    await act(async () => {});
    expect(postedAsks()).toEqual([]);
  });
});

describe("the video's page (/simulation/[id])", () => {
  it("phone: directly under the hero, before the moment", async () => {
    setWidth(393);
    renderVideo();
    await waitFor(() => expect(askRow()).not.toBeNull());
    const heroBox = document.querySelector('[data-result="hero"]')!.parentElement!;
    expect(heroBox.nextElementSibling).toBe(askRow()!.parentElement);
    expect(postedAsks()).toEqual(["/api/posted?analysisId=fixture-early"]);
  });

  it("phone: the slot takes no room while the link is read", async () => {
    setWidth(393);
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/analysis/")) return json(early);
      if (url.startsWith("/api/posted?")) return new Promise<Response>((resolve) => (release = resolve));
      return json({ url: "https://videos.test/clip.mp4" });
    });
    renderVideo();
    await waitFor(() => expect(document.querySelector('[data-result="hero"]')).not.toBeNull());
    const slot = document.querySelector('[data-result="hero"]')!.parentElement!.nextElementSibling as HTMLElement;
    expect(slot.childElementCount).toBe(0);
    expect(slot.className).toContain("empty:hidden");
    await act(async () => release(json({ posted: null })));
    await waitFor(() => expect(askRow()).not.toBeNull());
  });

  it("desk: in the right column, directly under the sentence's card", async () => {
    setWidth(1440);
    answers.posted = posted({ said: { number: 46, measure: "end" }, pieceKey: "fixture-early" });
    renderVideo();
    await waitFor(() => expect(afterCard()).not.toBeNull());
    const sentenceCard = document.querySelector('[data-result="sentence-card"]')!;
    expect(sentenceCard.querySelector('[data-result="moment"]')).not.toBeNull();
    expect(sentenceCard.nextElementSibling).toBe(afterCard()!.parentElement);
    expect(afterCard()!.textContent).toContain("46%watch to the end");
  });

  it("a run with no audience (no number): nothing, and the link is not asked for", async () => {
    setWidth(393);
    answers.analysis = () => json(noAudience);
    renderVideo();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    await act(async () => {});
    expect(askRow()).toBeNull();
    expect(postedAsks()).toEqual([]);
  });

  it("not here: nothing, and the link is not asked for", async () => {
    answers.analysis = () => json({ error: "Not found" }, 404);
    renderVideo();
    // The row is asked for twice (its own one retry, a second apart) before the page says so.
    expect(await screen.findByText("This simulation is not here.", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(postedAsks()).toEqual([]);
  });

  it("while the run loads: nothing", async () => {
    answers.analysis = () => null;
    renderVideo();
    await act(async () => {});
    expect(askRow()).toBeNull();
    expect(postedAsks()).toEqual([]);
  });
});
