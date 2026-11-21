/** @vitest-environment happy-dom */
/**
 * The result page's states on recorded runs (spec §5, plan Task 2). The page, the state function,
 * the playhead, the panel switch and the stubs are real; only the router and the network (`fetch`)
 * are stood in for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.setConfig({ testTimeout: 20_000 });

// The flag is a build-time constant; this file is the flag-on build.
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/simulation/x" }));

import { videoStateOf } from "@/lib/result/video-model";
import { forgetRunVideos, runVideoOf } from "@/lib/result/run-video";
import type { ResultRow, ResultState } from "@/lib/result/types";
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/session-expired";
import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import { useShellStore } from "@/stores/shell-store";
import early from "@/lib/result/__tests__/fixtures/early.json";
import ending from "@/lib/result/__tests__/fixtures/ending.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import leak from "@/lib/result/__tests__/fixtures/leak.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import noAudience from "@/lib/result/__tests__/fixtures/no-audience.json";
import noGroups from "@/lib/result/__tests__/fixtures/no-groups.json";
import opening from "@/lib/result/__tests__/fixtures/opening.json";
import { ResultPage, type ResultPageState } from "../result-page";

const stateOf = (fixture: unknown): ResultState => videoStateOf(fixture as ResultRow);

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const renderPage = (state: ResultPageState, props: { simulateAgain?: boolean } = {}) =>
  render(<ResultPage state={state} {...props} />, { wrapper });

const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });

const encoder = new TextEncoder();
const sseResponse = (text: string) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );

/** The network: the video's signed address and the analyze stream. */
function stubNetwork({ analyze }: { analyze: () => Response }) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.startsWith("/api/videos/sign")) {
      return new Response(JSON.stringify({ url: "https://videos.test/clip.mp4" }), { status: 200 });
    }
    if (url.startsWith("/api/analyze")) return analyze();
    throw new Error(`unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setWidth(1440);
  router.push.mockReset();
  router.replace.mockReset();
  router.back.mockReset();
  useShellStore.setState({ pushedTitle: "" });
});

afterEach(() => {
  client.clear();
  forgetRunVideos();
  setWidth(realWidth);
  vi.unstubAllGlobals();
});

describe("loading", () => {
  it("is the frame with empty cards and no text", () => {
    const { container } = renderPage({ kind: "loading" });
    expect(container.textContent?.trim()).toBe("");
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe("not found", () => {
  it("says so and offers the way Home", () => {
    renderPage({ kind: "not-found" });
    expect(screen.getByText("This simulation is not here.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(router.push).toHaveBeenCalledWith("/home");
  });
});

describe("running", () => {
  // Layout does not run here: the running screen's stage is measured through a stand-in
  // ResizeObserver reporting the reference desktop's content area.
  class FakeResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, contentRect: { width: 1192, height: 832 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  beforeEach(() => vi.stubGlobal("ResizeObserver", FakeResizeObserver));

  it("shows the running screen and names the screen 'Simulating'", () => {
    const { container } = renderPage({ kind: "running", id: "run-1", startedAt: null });
    expect(container.querySelector('[data-result="running-ring"]')).not.toBeNull();
    expect(useShellStore.getState().pushedTitle).toBe("Simulating");
    // On desktop the page's heading names it (the phone's is the shell's pushed header).
    expect(screen.getByRole("heading", { level: 1, name: "Simulating" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/%/);
  });

  it("another run starts fresh: its groups arrive again instead of appearing at once", () => {
    type Listener = (event: MessageEvent) => void;
    const opened: Array<{ url: string; listeners: Map<string, Listener[]> }> = [];
    vi.stubGlobal(
      "EventSource",
      class {
        listeners = new Map<string, Listener[]>();
        constructor(public url: string) {
          opened.push(this);
        }
        addEventListener(type: string, listener: Listener) {
          this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
        }
        removeEventListener() {}
        close() {}
      },
    );
    const roster = JSON.stringify({ personas: Array.from({ length: 10 }, (_, i) => ({ archetype: `group-${i}` })) });
    const sendRoster = () => act(() => opened.at(-1)!.listeners.get("roster")!.forEach((l) => l({ data: roster } as MessageEvent)));
    const wedges = (c: HTMLElement) => c.querySelectorAll("[data-wedge]").length;
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderPage({ kind: "running", id: "run-1", startedAt: null });
      sendRoster();
      act(() => vi.advanceTimersByTime(600));
      expect(wedges(container)).toBe(10);

      rerender(<ResultPage state={{ kind: "running", id: "run-2", startedAt: null }} />);
      expect(opened.at(-1)!.url).toBe("/api/analyze/run-2/stream");
      sendRoster();

      expect(wedges(container)).toBeLessThan(10);
    } finally {
      vi.useRealTimers();
    }
  });

  const body = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-result-body]");

  it("the result fades in when the run finishes while the page is open", () => {
    const { container, rerender } = renderPage({ kind: "running", id: "run-1", startedAt: null });
    expect(body(container)?.hasAttribute("data-arrived")).toBe(false);

    rerender(<ResultPage state={stateOf(early)} />);

    expect(container.querySelector('[data-result="gauge"]')).not.toBeNull();
    expect(body(container)?.hasAttribute("data-arrived")).toBe(true);
    // Opacity only: an animated transform or filter would, for its 400 ms, make the pinned
    // compact player position against the page body instead of the screen.
    const fade = body(container)?.className ?? "";
    expect(fade).toMatch(/motion-safe:transition-opacity/);
    expect(fade).toMatch(/motion-safe:starting:opacity-0/);
    expect(fade).not.toMatch(/animate-in|fade-in|zoom|slide|spin|blur|translate|scale|rotate|transform|filter/);
  });

  it("a run that turns into no audience fades in too", () => {
    const { container, rerender } = renderPage({ kind: "running", id: "run-1", startedAt: null });

    rerender(<ResultPage state={{ kind: "no-audience", id: "run-1", title: "Video", videoPath: null }} />);

    expect(screen.getByText("No audience came back.")).toBeInTheDocument();
    expect(body(container)?.hasAttribute("data-arrived")).toBe(true);
  });

  it("a run that stalls does not fade in", () => {
    const { container, rerender } = renderPage({ kind: "running", id: "run-1", startedAt: null });

    rerender(<ResultPage state={{ kind: "stalled", id: "run-1" }} />);

    expect(screen.getByText("This simulation did not finish.")).toBeInTheDocument();
    expect(body(container)?.hasAttribute("data-arrived")).toBe(false);
  });

  it("a result opened directly does not fade in", () => {
    const { container } = renderPage(stateOf(early));
    expect(container.querySelector('[data-result="gauge"]')).not.toBeNull();
    expect(body(container)?.hasAttribute("data-arrived")).toBe(false);
    expect(body(container)?.className ?? "").not.toMatch(/fade-in|opacity/);
  });
});

describe("stalled", () => {
  it("a run that never finished says so and offers the way Home", () => {
    renderPage({ kind: "stalled", id: "run-1" });
    expect(screen.getByText("This simulation did not finish.")).toBeInTheDocument();
    expect(screen.queryByText("Simulating…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().pushedTitle).toBe("Video");
  });
});

/** Switches the dormant "Simulate again" on, as a later slice will. */
const AGAIN = { simulateAgain: true } as const;

describe("no audience", () => {
  it("a stored run without viewers: the line, and no button when there is no file to simulate", () => {
    const state = stateOf(noAudience);
    expect(state.kind).toBe("no-audience");
    renderPage(state);
    expect(screen.getByText("No audience came back.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate again/ })).toBeNull();
    expect(useShellStore.getState().pushedTitle).toBe("Video");
    // No number, no curve, no panels, no craft score.
    expect(document.body.textContent).not.toMatch(/\d+%|76/);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("a run whose viewers carry no group is shown as no audience too", () => {
    expect(stateOf(noGroups).kind).toBe("no-audience");
  });

  // "Simulate again" is built and tested but NOT offered yet: the server treats the stored file
  // as a fresh upload and deletes it when the new run is refused or fails (found in review,
  // 2026-11-20). The page shows it only when `simulateAgain` is switched on.
  it("offers no 'Simulate again' unless it is switched on, even with the file stored", async () => {
    stubNetwork({ analyze: () => new Response("{}", { status: 500 }) });
    renderPage({ kind: "no-audience", id: "run-1", title: "Video", videoPath: "user-1/clip.mp4" });
    await waitFor(() => expect(document.querySelector("video")).not.toBeNull());
    expect(screen.queryByRole("button", { name: /Simulate again/ })).toBeNull();
  });

  it("offers no 'Simulate again' when the stored file is gone", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/videos/sign")) return new Response("{}", { status: 404 });
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage({ kind: "no-audience", id: "run-1", title: "Video", videoPath: "user-1/gone.mp4" }, AGAIN);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /Simulate again/ })).toBeNull();
  });

  it("'Simulate again' starts a new run of the same video and opens it in place of this page", async () => {
    const fetchMock = stubNetwork({ analyze: () => sseResponse('event: started\ndata: {"id":"new-1"}\n\n') });
    renderPage({ kind: "no-audience", id: "run-1", title: "Video", videoPath: "user-1/clip.mp4" }, AGAIN);

    const button = await screen.findByRole("button", { name: "Simulate again" });
    fireEvent.click(button);
    expect(button).toBeDisabled();

    // replace, not push: Back from the new run must not land on this page and invite a second paid run.
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/simulation/new-1"));
    expect(router.push).not.toHaveBeenCalled();
    const analyzeCall = fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/analyze"));
    expect(JSON.parse((analyzeCall![1] as RequestInit).body as string).video_storage_path).toBe("user-1/clip.mp4");
    // The new run's screen plays the video this page already holds while the run is in flight.
    expect(runVideoOf("new-1")).toBe("https://videos.test/clip.mp4");
  });

  it("when the new run cannot start: says so under the button, and the button works again", async () => {
    stubNetwork({ analyze: () => new Response("{}", { status: 500 }) });
    renderPage({ kind: "no-audience", id: "run-1", title: "Video", videoPath: "user-1/clip.mp4" }, AGAIN);

    fireEvent.click(await screen.findByRole("button", { name: "Simulate again" }));
    expect(await screen.findByText("Could not start. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate again" })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not pull the creator back if they left before the new run started", async () => {
    let release: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => (release = resolve));
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/videos/sign")) {
        return new Response(JSON.stringify({ url: "https://videos.test/clip.mp4" }), { status: 200 });
      }
      return pending;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderPage({ kind: "no-audience", id: "run-1", title: "Video", videoPath: "user-1/clip.mp4" }, AGAIN);

    fireEvent.click(await screen.findByRole("button", { name: "Simulate again" }));
    unmount();
    await act(async () => {
      release(sseResponse('event: started\ndata: {"id":"new-1"}\n\n'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  // "Simulate again" is a paid request. Like every other one in the app it must tell a dead
  // session and a spent allowance apart from a failure (src/lib/auth/session-expired.ts,
  // src/lib/billing/credit-wall.ts): the app-wide notices are raised, and the page does not
  // accuse the run of failing.
  it("'Simulate again' with a dead session: raises the sign-in notice and says what happened", async () => {
    stubNetwork({ analyze: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) });
    const raised = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, raised);
    renderPage({ kind: "no-audience", id: "run-1", title: "Video", videoPath: "user-1/clip.mp4" }, AGAIN);

    fireEvent.click(await screen.findByRole("button", { name: "Simulate again" }));

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument();
    expect(raised).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Could not start. Try again.")).toBeNull();
    expect(screen.getByRole("button", { name: "Simulate again" })).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, raised);
  });

  it("'Simulate again' with the allowance spent: raises the credit wall and draws no error of its own", async () => {
    const quota = {
      error: "credit_quota_exceeded",
      message: "Your credits are spent.",
      tier: "free",
      used: 50,
      limit: 50,
      inTrial: true,
      reason: "allowance",
      cost: 10,
    };
    stubNetwork({ analyze: () => new Response(JSON.stringify(quota), { status: 402 }) });
    const raised = vi.fn();
    window.addEventListener(CREDIT_WALL_EVENT, raised);
    renderPage({ kind: "no-audience", id: "run-1", title: "Video", videoPath: "user-1/clip.mp4" }, AGAIN);

    fireEvent.click(await screen.findByRole("button", { name: "Simulate again" }));

    await waitFor(() => expect(raised).toHaveBeenCalledTimes(1));
    expect((raised.mock.calls[0]![0] as CustomEvent).detail).toMatchObject({ reason: "allowance", cost: 10 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Simulate again" })).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    window.removeEventListener(CREDIT_WALL_EVENT, raised);
  });
});

describe("result", () => {
  it("names the screen with the clip's length, and clears the name when it leaves", () => {
    const { unmount } = renderPage(stateOf(early));
    expect(useShellStore.getState().pushedTitle).toBe("Video · 0:29");
    unmount();
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("desktop: the header row carries Back and the title", () => {
    renderPage(stateOf(early));
    expect(screen.getByRole("heading", { level: 1, name: "Video · 0:29" })).toBeInTheDocument();
    window.history.pushState({}, "", "/somewhere");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalled();
  });

  it.each([
    ["early", early, "A third leave by 0:03."],
    ["middle", middle, "Half leave by 0:17."],
    ["leak", leak, "They leave bit by bit."],
    ["holds", holds, "Most watch to the end."],
    ["opening", opening, null],
    ["ending", ending, null],
  ] as const)("%s: renders the run with its sentence and no craft score", (_name, fixture, sentence) => {
    const state = stateOf(fixture);
    expect(state.kind).toBe("result");
    renderPage(state);
    if (state.kind !== "result") return;
    expect(screen.getByText(sentence ?? state.model.verdict.sentence)).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    // The craft grader's score must not be on the page. The page's own number can happen to equal
    // it (`opening`: both are 71), and a time such as "0:29" is not a score.
    const craft = (fixture as { overall_score: number }).overall_score;
    if (craft !== state.model.headline.value) {
      expect(text).not.toMatch(new RegExp(`(^|[^\\d:])${craft}(?![\\d:])`));
    }
    expect(text).not.toMatch(/Low confidence|Don.t post yet|craft/i);
  });

  it("desktop: the video, the gauge beside the moment, the line as its own card, the switch and a panel", () => {
    const { container } = renderPage(stateOf(early));
    for (const name of ["video", "gauge", "moment", "curve", "tabs", "panel"]) {
      expect(container.querySelector(`[data-result="${name}"]`), name).not.toBeNull();
    }
    expect(container.querySelector('[data-result="hero"]')).toBeNull();
  });

  it("phone: the hero card, the moment, the switch and a panel", async () => {
    setWidth(393);
    const { container } = renderPage(stateOf(early));
    await waitFor(() => expect(container.querySelector('[data-result="hero"]')).not.toBeNull());
    for (const name of ["moment", "tabs", "panel"]) {
      expect(container.querySelector(`[data-result="${name}"]`), name).not.toBeNull();
    }
  });
});

describe("the panel switch", () => {
  const tabs = () => screen.getAllByRole("tab");
  const selected = () => tabs().find((tab) => tab.getAttribute("aria-selected") === "true")!;
  const panel = () => screen.getByRole("tabpanel");

  it("the panel is a Tab stop, so a panel without controls can still be reached and read", () => {
    renderPage(stateOf(early));
    expect(panel()).toHaveAttribute("tabindex", "0");
  });

  it("three tabs in this order, Audience first selected, its panel shown", () => {
    renderPage(stateOf(early));
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Brain", "Engagement", "Audience"]);
    expect(selected()).toHaveTextContent("Audience");
    expect(panel()).toHaveAttribute("aria-labelledby", selected().id);
    expect(panel().querySelector('[data-result="audience"]')).not.toBeNull();
  });

  it("only the selected tab is in the Tab order", () => {
    renderPage(stateOf(early));
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
  });

  it("left and right arrows move the selection and the focus, and wrap", () => {
    renderPage(stateOf(early));
    act(() => selected().focus());

    fireEvent.keyDown(selected(), { key: "ArrowLeft" });
    expect(selected()).toHaveTextContent("Engagement");
    expect(document.activeElement).toBe(selected());
    expect(panel().querySelector('[data-result="engagement"]')).not.toBeNull();

    fireEvent.keyDown(selected(), { key: "ArrowRight" });
    fireEvent.keyDown(selected(), { key: "ArrowRight" });
    expect(selected()).toHaveTextContent("Brain");
    expect(panel().querySelector('[data-result="brain"]')).not.toBeNull();

    fireEvent.keyDown(selected(), { key: "ArrowLeft" });
    expect(selected()).toHaveTextContent("Audience");
  });

  it("a click selects", () => {
    renderPage(stateOf(early));
    fireEvent.click(screen.getByRole("tab", { name: "Engagement" }));
    expect(selected()).toHaveTextContent("Engagement");
  });
});
