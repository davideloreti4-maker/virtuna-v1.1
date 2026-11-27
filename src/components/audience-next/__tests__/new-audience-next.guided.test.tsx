/** @vitest-environment happy-dom */
/**
 * NewAudienceNext, guided (plan 01-start-and-profile, Task 9): the first build /start held starts here, once,
 * and the building view shows in place of the form. Rendered for real with the real hooks and storage;
 * stand-ins only at the edges: `fetch` (the read answers a stream that stays open until the test ends), the
 * router, the build-time flag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/audience/new" }));

import { ToastProvider } from "@/components/ui/toast";
import { buildRequestOf } from "@/lib/audience-next/build-request";
import { FIRST_BUILD_KEY, holdFirstBuild } from "@/lib/onboarding/first-build";

import { NewAudienceNext } from "../new-audience-next";

const CALIBRATE = "POST /api/audiences/calibrate";
let calls: { key: string; body: unknown }[];
let streams: ReadableStreamDefaultController<Uint8Array>[];

beforeEach(() => {
  calls = [];
  streams = [];
  window.sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${String(input)}`;
      calls.push({ key, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      if (key === CALIBRATE) {
        const body = new ReadableStream<Uint8Array>({ start: (c) => void streams.push(c) });
        return { ok: true, status: 200, body } as unknown as Response;
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }),
  );
});

afterEach(async () => {
  // A read left open would stay "on its way" for the next test (the record outlives a page): end it.
  for (const c of streams) {
    try {
      c.close();
    } catch {
      // Already ended.
    }
  }
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  cleanup();
  vi.unstubAllGlobals();
});

function show(guided: boolean, { strict = false }: { strict?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <NewAudienceNext initialDoor="own" prefill="" inUse={false} guided={guided} />
      </ToastProvider>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}
const sent = () => calls.filter((c) => c.key === CALIBRATE);

describe("NewAudienceNext, guided", () => {
  it("starts the held account read once, shows it building, and empties the hold", async () => {
    const request = buildRequestOf("own", "nia.guided")!;
    holdFirstBuild(window.sessionStorage, request);
    show(true);
    await act(async () => {});
    expect(sent()).toEqual([{ key: CALIBRATE, body: request }]);
    expect(window.sessionStorage.getItem(FIRST_BUILD_KEY)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.querySelectorAll("[data-step]").length).toBeGreaterThan(0);
  });

  it("under Strict Mode's double effect run: still one read sent, and the building view shows", async () => {
    const request = buildRequestOf("own", "nia.strict")!;
    holdFirstBuild(window.sessionStorage, request);
    show(true, { strict: true });
    await act(async () => {});
    expect(sent()).toEqual([{ key: CALIBRATE, body: request }]);
    expect(window.sessionStorage.getItem(FIRST_BUILD_KEY)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("starts a held description read", async () => {
    const request = buildRequestOf("describe", "budget meals for students")!;
    holdFirstBuild(window.sessionStorage, request);
    show(true);
    await act(async () => {});
    expect(sent()).toEqual([{ key: CALIBRATE, body: request }]);
  });

  it("nothing held (a reload): the form, nothing sent", async () => {
    show(true);
    await act(async () => {});
    expect(sent()).toHaveLength(0);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("not guided: a held read is left alone", async () => {
    holdFirstBuild(window.sessionStorage, buildRequestOf("own", "nia.unguided")!);
    show(false);
    await act(async () => {});
    expect(sent()).toHaveLength(0);
    expect(window.sessionStorage.getItem(FIRST_BUILD_KEY)).not.toBeNull();
  });

  it("a held value that is no request starts nothing, and is dropped", async () => {
    window.sessionStorage.setItem(FIRST_BUILD_KEY, JSON.stringify({ handle: "nia cooks", type: "personal" }));
    show(true);
    await act(async () => {});
    expect(sent()).toHaveLength(0);
    expect(window.sessionStorage.getItem(FIRST_BUILD_KEY)).toBeNull();
  });
});
