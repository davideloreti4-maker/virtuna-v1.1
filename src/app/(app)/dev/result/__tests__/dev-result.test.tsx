/** @vitest-environment happy-dom */
/**
 * The dev page's running moments (`/dev/result?processing=1&…`): what the preview hands the running
 * screen. Real: the dev page's client part, the result page, the running screen, the query client.
 * Stand-ins: the router, the window's width, the clock and the visitor's motion setting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dev/result",
}));

import early from "@/lib/result/__tests__/fixtures/early.json";
import type { ResultRow } from "@/lib/result/types";
import { DevResult } from "../dev-result";

const realWidth = window.innerWidth;
const realMatchMedia = window.matchMedia;
/** The visitor asked for less motion: the result arrives without its landing (no animation frames to drive). */
function reduceMotion() {
  window.matchMedia = ((query: string) => ({
    matches: !query.includes("no-preference"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });

let client: QueryClient;
const renderDev = (props: Partial<ComponentProps<typeof DevResult>> = {}) =>
  render(
    <QueryClientProvider client={client}>
      <DevResult
        row={structuredClone(early) as unknown as ResultRow}
        frames="https://frames.test/run"
        video={null}
        processing
        t={undefined}
        simulateAgain={false}
        run={{ own: false, elapsed: 42 }}
        {...props}
      />
    </QueryClientProvider>,
  );

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setWidth(393);
});
afterEach(() => {
  client.clear();
  setWidth(realWidth);
  window.matchMedia = realMatchMedia;
  vi.useRealTimers();
});

describe("the dev page's running moment", () => {
  it("cover= is the post's cover the stream named", () => {
    const { container } = renderDev({ run: { own: false, cover: "https://p.test/cover.jpg", elapsed: 42 } });
    const picture = container.querySelector('[data-result="running-picture"]')!;
    expect(picture.getAttribute("data-shows")).toBe("cover");
    expect(picture.querySelector("img")!.getAttribute("src")).toBe("https://p.test/cover.jpg");
    expect(container.querySelector('[data-result="running-clock"]')!.textContent).toBe("0:42");
  });

  it("cover= that is not an https address is not loaded", () => {
    for (const cover of ["http://p.test/cover.jpg", "/api/anything", "javascript:alert(1)", "not an address"]) {
      const { container, unmount } = renderDev({ run: { own: false, cover, elapsed: 42 } });
      const picture = container.querySelector('[data-result="running-picture"]')!;
      expect(picture.getAttribute("data-shows")).toBe("none");
      expect(picture.querySelector("img")).toBeNull();
      unmount();
    }
  });

  it("runframes= fills that many tiles of the strip, from the frames' base", () => {
    const { container } = renderDev({ run: { own: false, frames: 3, elapsed: 0 } });
    const srcs = [...container.querySelectorAll('[data-result="running-strip"] img')].map((img) => img.getAttribute("src"));
    expect(srcs).toEqual(["https://frames.test/run/0.jpg", "https://frames.test/run/1.jpg", "https://frames.test/run/2.jpg"]);
  });

  it("land= turns the running moment into the result after that many seconds", () => {
    reduceMotion();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const { container } = renderDev({ land: 3 });
    expect(container.querySelector('[data-result="running"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(2999));
    expect(container.querySelector('[data-result="count"]')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-result="running"]')).toBeNull();
    expect(container.querySelector('[data-result="count"]')).toHaveTextContent("461 of 1,000 watched to the end");
    expect(container.querySelector("[data-result-body]")!.hasAttribute("data-arrived")).toBe(true);
  });
});
