/** @vitest-environment happy-dom */
/**
 * The whole chain of a run opened while it simulates (`/simulation/[id]`): the stored row says the
 * run is in flight, the running screen listens to the run's stream, the stream's finish asks for
 * the row again, and the page turns into the result. Real: SimulationScreen, useSimulationRow,
 * TanStack Query, the state function, the result page, the running screen and its stream hook.
 * Stood in for: the network (`fetch`), the browser's EventSource, the stage's measured size
 * (ResizeObserver), the router, and the build-time flag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/simulation/fixture-early" }));

import early from "@/lib/result/__tests__/fixtures/early.json";
import { queryKeys } from "@/lib/queries/query-keys";
import { SimulationScreen } from "../simulation-screen";

type Listener = (event: MessageEvent) => void;
class FakeEventSource {
  static readonly CLOSED = 2;
  static opened: FakeEventSource[] = [];
  readyState = 1;
  private listeners = new Map<string, Set<Listener>>();
  constructor(public url: string) {
    FakeEventSource.opened.push(this);
  }
  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  send(type: string, data: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener({ data: JSON.stringify(data) } as MessageEvent);
  }
}

class FakeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target, contentRect: { width: 1192, height: 832 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

const stream = () => FakeEventSource.opened.at(-1)!;
const roster = { personas: Array.from({ length: 10 }, (_, i) => ({ archetype: `group-${i}` })) };

let client: QueryClient;
let finished = false;
const fetchMock = vi.fn(async (url: string): Promise<Response> => {
  if (url === "/api/analysis/fixture-early") {
    // The stored row: in flight (started a few seconds ago) until the run has finished.
    const row = finished ? early : { ...early, processing: true, created_at: new Date(Date.now() - 4000).toISOString() };
    return new Response(JSON.stringify(row), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response("{}", { status: 404 });
});

beforeEach(() => {
  client = new QueryClient();
  finished = false;
  fetchMock.mockReset(); // back to the answers above (a test may hold or change them)
  FakeEventSource.opened = [];
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

describe("a run opened while it simulates", () => {
  it("shows the running screen, the groups as they arrive, and turns into the result at the finish", async () => {
    const { container } = render(
      <QueryClientProvider client={client}>
        <SimulationScreen id="fixture-early" />
      </QueryClientProvider>,
    );
    const ring = () => container.querySelector('[data-result="running-ring"]');

    // The row answers in flight: the running screen, listening to this run's stream.
    await waitFor(() => expect(ring()).not.toBeNull());
    expect(stream().url).toBe("/api/analyze/fixture-early/stream");
    expect(container.querySelectorAll("[data-wedge]")).toHaveLength(0);

    act(() => stream().send("roster", roster));
    await waitFor(() => expect(container.querySelectorAll("[data-wedge]")).toHaveLength(10));

    // The finish: the stream says so and the row, asked for again, has finished.
    const asked = fetchMock.mock.calls.length;
    finished = true;
    act(() => stream().send("complete"));

    await waitFor(() => expect(screen.getByRole("img", { name: /^46% watch to the end/ })).toBeInTheDocument());
    expect(fetchMock.mock.calls.length).toBeGreaterThan(asked);
    expect(FakeEventSource.opened.every((source) => source.readyState === FakeEventSource.CLOSED)).toBe(true);
    expect(ring()).toBeNull();
  });
});

describe("a run opened again after the stall limit, last seen in flight", () => {
  const sevenMinutesAgo = () => new Date(Date.now() - 7 * 60_000).toISOString();
  const answer = (row: unknown) =>
    new Response(JSON.stringify(row), { status: 200, headers: { "Content-Type": "application/json" } });
  const renderScreen = () =>
    render(
      <QueryClientProvider client={client}>
        <SimulationScreen id="fixture-early" />
      </QueryClientProvider>,
    );

  it("says nothing it does not know while it asks again, then shows the result", async () => {
    // Opened while it simulated, left, opened again 7 minutes after the start: the cached row still
    // says processing. Until the row answers, the page must not claim the run did not finish.
    client.setQueryData(queryKeys.analysis.detail("fixture-early"), { ...early, processing: true, created_at: sevenMinutesAgo() });
    let release: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)));

    const { container } = renderScreen();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("This simulation did not finish.")).toBeNull();
    expect(container.querySelector('[data-result="running-ring"]')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await act(async () => release(answer(early)));

    await waitFor(() => expect(screen.getByRole("img", { name: /^46% watch to the end/ })).toBeInTheDocument());
    expect(screen.queryByText("This simulation did not finish.")).toBeNull();
  });

  it("says the run did not finish when the row, asked again, is still in flight", async () => {
    const startedAt = sevenMinutesAgo();
    client.setQueryData(queryKeys.analysis.detail("fixture-early"), { ...early, processing: true, created_at: startedAt });
    fetchMock.mockImplementation(async () => answer({ ...early, processing: true, created_at: startedAt }));

    renderScreen();

    expect(await screen.findByText("This simulation did not finish.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });
});
