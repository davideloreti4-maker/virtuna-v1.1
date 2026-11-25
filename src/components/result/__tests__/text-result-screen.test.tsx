/** @vitest-environment happy-dom */
/**
 * TextResultScreen — `/simulation/hook/[threadId]/[key]` asks the endpoint for the seal and draws the
 * page (spec §4). Real: the screen, useTextSeal, TanStack Query, the model, the view. Stood in for: the
 * network (`fetch`), the router, the build-time flag.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// The (app) layout's toast provider: the posted link's remove reports a refusal there.
import { ToastProvider } from "@/components/ui/toast";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/simulation/hook/t/k" }));

import { HOOK_1_POPULATION, MEAL_PREP_HOOKS } from "@/components/thread-next/__tests__/fixtures/answers";
import type { TextResultAs } from "@/lib/result/text-result";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import { useBoardStore } from "@/stores/board-store";
import { TextResultScreen } from "../text-result-screen";

const THREAD = "00000000-0000-4000-8000-0000000000bb";
const HOOK = MEAL_PREP_HOOKS[0]!.props.hookLine;
let KEY = "";
beforeAll(async () => {
  KEY = await sealHashOf(HOOK);
});

function answer(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen(as: TextResultAs = "hook") {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <TextResultScreen threadId={THREAD} sealKey={KEY} as={as} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.push.mockReset();
});

describe("TextResultScreen", () => {
  it("asks for the seal once, shows the quiet blocks, then the result", async () => {
    const fetchMock = answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
    renderScreen();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await screen.findByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByText(HOOK)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/threads/${THREAD}/seals/${KEY}`);
    // The seal once; once the result is in, the piece's posted link once too (plan 2026-11-24-after-posting).
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `/api/threads/${THREAD}/seals/${KEY}`,
      `/api/posted?threadId=${THREAD}&key=${KEY}`,
    ]);
  });

  it("404: This simulation isn't here. (asked once, not retried)", async () => {
    const fetchMock = answer(404, { error: "Not found" });
    renderScreen();
    expect(await screen.findByText("This simulation isn't here.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a seal whose population has no number: not here either", async () => {
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: { total: 1000, segments: [], reasons: [] }, open: true });
    renderScreen();
    expect(await screen.findByText("This simulation isn't here.")).toBeInTheDocument();
  });

  it("?as=opening: Opening line, no primary", async () => {
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
    renderScreen("opening");
    await screen.findByRole("img", { name: "30% would stop to watch" });
    expect(screen.getByRole("heading", { level: 1, name: "Opening line" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Script this one/ })).toBeNull();
  });

  it("opening the page leaves nothing behind: only a tap on its button does", async () => {
    sessionStorage.clear();
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
    renderScreen();
    await screen.findByRole("button", { name: "Script this one, 2 credits" });
    expect(sessionStorage.length).toBe(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Script this one: leaves the text for this page's thread, points the thread at it and goes home", async () => {
    document.cookie = "maven_active_thread=; path=/; max-age=0";
    sessionStorage.clear();
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Script this one, 2 credits" }));
    const left = JSON.parse(sessionStorage.getItem("maven:script-from")!) as Record<string, unknown>;
    expect(left).toMatchObject({ threadId: THREAD, text: HOOK });
    expect(typeof left.at).toBe("number");
    expect(document.cookie).toContain(`maven_active_thread=${THREAD}`);
    expect(useBoardStore.getState().activeThreadId).toBe(THREAD);
    expect(router.push).toHaveBeenCalledWith("/home");
  });

  it("an archived thread's result has no \"Script this one\" (a new turn would land in another thread)", async () => {
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: false });
    renderScreen();
    expect(await screen.findByText("Would stop, by group")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Script this one/ })).toBeNull();
  });
});
