/** @vitest-environment happy-dom */
/**
 * NewAudienceNext — `/audience/new` with its data (spec 2026-11-25-audience, 3.6), rendered for real: the
 * form, the building view, the real hooks (the read, and the audience new chats use, through a real
 * QueryClient), the real toasts and shell store. Stand-ins only at the edges: `fetch` (the read answers a
 * made-up stream the test writes to, frames as the route writes them), the router, the build-time flag (on)
 * and, for the three-minute line, the clock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/audience/new" }));

import { ToastProvider } from "@/components/ui/toast";
import { useAudienceChangedElsewhere } from "@/hooks/queries/use-audience-next";
import { SLOW_AFTER_MS } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS as S, fromVideos, newChatsUse, readCount, stillReading } from "@/lib/audience-next/audience-words";
import { buildRequestOf, type NewDoor } from "@/lib/audience-next/build-request";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";
import { useShellStore } from "@/stores/shell-store";

import { NewAudienceNext } from "../new-audience-next";

// ─── The edges ───────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const CALIBRATE = "POST /api/audiences/calibrate";
const PUT_DEFAULT = "PUT /api/settings/last-audience";
const MADE = "00000000-0000-4000-8000-0000000000aa";
const READ = "Reading your followers";
const WATCH = "Watching your videos";
const BUILD = "Building your audience profile";
const SYNTHESIS = "We read @nia.tests fine — building the audience from it is what failed. Nothing is wrong with the handle; try again.";

/** A stream the test writes to, as the route would. */
function madeUpStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    body,
    send: (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
    close: () => controller.close(),
  };
}

interface Call {
  key: string;
  body: unknown;
}
let calls: Call[];
let stream: ReturnType<typeof madeUpStream>;
/** Refused requests, by "METHOD url", with their status. */
let refuse: Map<string, number>;
/** While set, the default's PUT is answered only once it resolves. */
let putGate: Promise<void> | null;
let raised: number;
const count = () => {
  raised += 1;
};

beforeEach(() => {
  calls = [];
  refuse = new Map();
  putGate = null;
  raised = 0;
  stream = madeUpStream();
  window.addEventListener(SESSION_EXPIRED_EVENT, count);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${String(input)}`;
      calls.push({ key, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      if (key === PUT_DEFAULT && putGate) await putGate;
      const status = refuse.get(key);
      if (status) return new Response(JSON.stringify({ error: "refused" }), { status });
      if (key === CALIBRATE) return { ok: true, status: 200, body: stream.body } as unknown as Response;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }),
  );
});

afterEach(async () => {
  vi.useRealTimers();
  // A read left open would stay on its way for the next test (the record outlives a page): end it.
  try {
    stream.close();
  } catch {
    // Already ended.
  }
  await settle();
  window.removeEventListener(SESSION_EXPIRED_EVENT, count);
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  router.push.mockReset();
  router.refresh.mockReset();
  useShellStore.setState({ pushedTitle: "" });
});

function show(initialDoor: NewDoor = "own", prefill = "", inUse = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <NewAudienceNext initialDoor={initialDoor} prefill={prefill} inUse={inUse} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Lets what the stream has been given be read, inside act. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const field = () => screen.getByRole("textbox");
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const press = () => fireEvent.click(screen.getByRole("button", { name: S.build }));
const sent = (key: string) => calls.filter((c) => c.key === key);
const stepAt = () => [...document.querySelectorAll("[data-step]")].map((li) => li.getAttribute("data-step"));
/** The step names as the list shows them (the status line repeats the one now running). */
const steps = () => [...document.querySelectorAll("[data-step] > span:not(.sr-only)")].map((s) => s.textContent);
const lit = () => document.querySelectorAll('[data-wedge][data-look="full"]').length;

/** A beforeunload as the browser fires it: true when the page asked to stay. */
function leaving(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function startOwn(handle = "nia.tests") {
  show("own");
  type(handle);
  press();
  await settle();
}

// ─── The form ────────────────────────────────────────────────────────────────

describe("NewAudienceNext: the form", () => {
  it.each([
    ["own", S.doorOwn, S.ownField],
    ["other", S.doorOther, S.otherField],
    ["describe", S.doorDescribe, S.describeField],
  ] as const)("opens on the door it is given: %s", (door, row, name) => {
    show(door);
    expect(screen.getByRole("radio", { name: row })).toBeChecked();
    expect(screen.getByRole("textbox", { name })).toBeInTheDocument();
  });

  it("the prefilled handle is in the field", () => {
    show("own", "nia.tests");
    expect(screen.getByRole("textbox", { name: S.ownField })).toHaveValue("nia.tests");
  });

  it("the handle stays between the two account rows; a description keeps its own text", () => {
    show("own", "leo.makes");
    fireEvent.click(screen.getByRole("radio", { name: S.doorOther }));
    expect(screen.getByRole("textbox", { name: S.otherField })).toHaveValue("leo.makes");
    fireEvent.click(screen.getByRole("radio", { name: S.doorDescribe }));
    expect(screen.getByRole("textbox", { name: S.describeField })).toHaveValue("");
    type("Busy parents who meal-prep");
    fireEvent.click(screen.getByRole("radio", { name: S.doorOwn }));
    expect(screen.getByRole("textbox", { name: S.ownField })).toHaveValue("leo.makes");
    fireEvent.click(screen.getByRole("radio", { name: S.doorDescribe }));
    expect(screen.getByRole("textbox", { name: S.describeField })).toHaveValue("Busy parents who meal-prep");
  });

  it.each([
    ["own", "@nia.tests", buildRequestOf("own", "nia.tests")],
    ["other", "leo.makes", buildRequestOf("other", "leo.makes")],
    ["other", "https://www.tiktok.com/@leo.makes/video/1234567890", buildRequestOf("other", "leo.makes")],
    ["describe", "Busy parents  who meal-prep", buildRequestOf("describe", "Busy parents who meal-prep")],
  ] as const)("%s, %j: the request body", async (door, value, request) => {
    show(door);
    type(value);
    press();
    await settle();
    expect(calls.map((c) => c.key)).toEqual([CALIBRATE]);
    expect(calls[0]!.body).toEqual(request);
  });

  it("nothing is sent from an empty field, or from one that is not a handle", async () => {
    show("own");
    press();
    type("not a handle");
    press();
    await settle();
    expect(calls).toEqual([]);
  });

  it("a second press sends nothing", async () => {
    show("own");
    type("nia.tests");
    act(() => {
      press();
      fireEvent.submit(document.querySelector("form")!);
    });
    await settle();
    expect(sent(CALIBRATE)).toHaveLength(1);
  });

  it("is clean for axe", async () => {
    const { container } = show("own");
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ─── Building ────────────────────────────────────────────────────────────────

describe("NewAudienceNext: building replaces the form", () => {
  it("through each phase, in the server's own step names, the face's initial in the middle", async () => {
    await startOwn();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: S.building })).toBeInTheDocument();
    expect(document.querySelector("[data-face]")).toHaveTextContent("N");
    expect(stepAt()).toEqual(["next", "next", "next"]);

    stream.send("status", { message: "Reading your followers…" });
    stream.send("stage", { name: READ, status: "active" });
    await settle();
    expect(stepAt()).toEqual(["now", "next", "next"]);
    expect(screen.getByRole("status")).toHaveTextContent(READ);
    expect(lit()).toBe(0);

    stream.send("stage", { name: READ, status: "done" });
    stream.send("stage", { name: WATCH, status: "active" });
    await settle();
    expect(stepAt()).toEqual(["done", "now", "next"]);
    expect(screen.getByRole("status")).toHaveTextContent(WATCH);
    expect(lit()).toBe(3);

    stream.send("stage", { name: WATCH, status: "done" });
    stream.send("stage", { name: BUILD, status: "active" });
    await settle();
    expect(stepAt()).toEqual(["done", "done", "now"]);
    expect(steps()).toEqual([READ, WATCH, BUILD]);
    expect(lit()).toBe(7);

    stream.send("stage", { name: BUILD, status: "done" });
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(stepAt()).toEqual(["done", "done", "done"]);
    expect(lit()).toBe(10);
    // Settling: the audience is made the one new chats use at once, but the page stays until the stream closes.
    expect(sent(PUT_DEFAULT).map((c) => c.body)).toEqual([{ audienceId: MADE }]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("the evidence: the picture in the middle, “From your videos · 12 read” and four covers", async () => {
    await startOwn();
    const videos = Array.from({ length: 12 }, (_, i) => ({ coverUrl: `https://cdn.example.test/${i}.jpg`, views: 100 + i }));
    stream.send("evidence", { handle: "nia.tests", avatarUrl: "https://cdn.example.test/nia.jpg", videos });
    await settle();
    expect(document.querySelector("[data-face] img")?.getAttribute("src")).toBe("https://cdn.example.test/nia.jpg");
    const card = document.querySelector("[data-evidence]") as HTMLElement;
    expect(card).toHaveTextContent(fromVideos("your"));
    expect(card).toHaveTextContent(readCount(12));
    expect(card.querySelectorAll("img")).toHaveLength(4);
  });

  it("another creator's evidence is “From their videos”", async () => {
    show("other");
    type("leo.makes");
    press();
    await settle();
    stream.send("evidence", { handle: "leo.makes", avatarUrl: "", videos: [{ coverUrl: null, views: 1 }] });
    await settle();
    expect(document.querySelector("[data-evidence]")).toHaveTextContent(fromVideos("their"));
    expect(document.querySelector("[data-face]")).toHaveTextContent("L");
  });

  it("a description: its own step names, no evidence card, the name's initial", async () => {
    show("describe");
    type("busy parents who meal-prep");
    press();
    await settle();
    stream.send("stage", { name: "Finding videos in that niche", status: "active" });
    stream.send("evidence", { handle: "x.tests", avatarUrl: "", videos: [{ coverUrl: null, views: 1 }] });
    await settle();
    expect(steps()).toEqual(["Finding videos in that niche", "Watching what performs there", BUILD]);
    expect(document.querySelector("[data-evidence]")).toBeNull();
    expect(document.querySelector("[data-face]")).toHaveTextContent("B");
  });

  it("“Taking longer than usual.” at 3:00, not at 2:59", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    show("own");
    type("nia.tests");
    press();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS - 1_000);
    });
    expect(screen.queryByText(S.slow)).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText(S.slow)).toBeInTheDocument();
  });

  it("asks to keep the page open while it runs, and holds the page; not after", async () => {
    show("own");
    expect(leaving()).toBe(false);
    type("nia.tests");
    press();
    await settle();
    expect(screen.getByText(S.keepOpen)).toBeInTheDocument();
    expect(leaving()).toBe(true);
    stream.send("fallback", { reason: "thin" });
    await settle();
    expect(leaving()).toBe(false);
  });

  it("holds the page while settling too, and lets go once done", async () => {
    await startOwn();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(leaving()).toBe(true);
    stream.close();
    await settle();
    expect(leaving()).toBe(false);
  });

  it("is clean for axe while running", async () => {
    await startOwn();
    stream.send("stage", { name: READ, status: "active" });
    stream.send("evidence", { handle: "nia.tests", avatarUrl: "", videos: [{ coverUrl: "https://cdn.example.test/1.jpg", views: 1 }] });
    await settle();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

// ─── The outcomes ────────────────────────────────────────────────────────────

describe("NewAudienceNext: done", () => {
  it("once the stream closes: the new audience becomes the one new chats use, then /audience", async () => {
    await startOwn();
    stream.send("done", { audience: { id: MADE } });
    stream.close();
    await settle();
    expect(sent(PUT_DEFAULT).map((c) => c.body)).toEqual([{ audienceId: MADE }]);
    expect(calls.map((c) => c.key)).toEqual([CALIBRATE, PUT_DEFAULT]);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/audience");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a refused PUT: the new audience's own page, and the toast says so", async () => {
    refuse.set(PUT_DEFAULT, 500);
    await startOwn();
    stream.send("done", { audience: { id: MADE } });
    stream.close();
    await settle();
    expect(router.push).toHaveBeenCalledWith(`/audience/${MADE}`);
    expect(router.push).not.toHaveBeenCalledWith("/audience");
    expect(await screen.findByText(S.switchFailed)).toBeInTheDocument();
  });

  it("a 401 on the PUT: the session dialog, the audience's page, no refusal toast", async () => {
    refuse.set(PUT_DEFAULT, 401);
    await startOwn();
    stream.send("done", { audience: { id: MADE } });
    stream.close();
    await settle();
    expect(raised).toBe(1);
    expect(router.push).toHaveBeenCalledWith(`/audience/${MADE}`);
    expect(screen.queryByText(S.switchFailed)).toBeNull();
  });

  it("the write goes out when the audience is made; once the stream closes the page waits for its answer", async () => {
    let answer!: () => void;
    putGate = new Promise<void>((resolve) => {
      answer = resolve;
    });
    await startOwn();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(sent(PUT_DEFAULT)).toHaveLength(1);
    stream.close();
    await settle();
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => answer());
    await settle();
    expect(router.push).toHaveBeenCalledWith("/audience");
    expect(sent(PUT_DEFAULT)).toHaveLength(1);
  });
});

describe("NewAudienceNext: the page left while the read runs", () => {
  /** The page inside providers that outlive it, as the app's layout does; `leave()` takes the page away. */
  function showLeavable() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const tree = (here: boolean) => (
      <QueryClientProvider client={client}>
        <ToastProvider>{here ? <NewAudienceNext initialDoor="own" prefill="" inUse={false} /> : null}</ToastProvider>
      </QueryClientProvider>
    );
    const view = render(tree(true));
    return { leave: () => act(() => view.rerender(tree(false))) };
  }

  async function startLeavable() {
    const page = showLeavable();
    type("nia.tests");
    press();
    await settle();
    return page;
  }

  it("left before the audience is made: it still becomes the one new chats use, a toast says so, nothing navigates", async () => {
    const { leave } = await startLeavable();
    leave();
    expect(screen.queryByRole("heading", { level: 2, name: S.building })).toBeNull();
    stream.send("stage", { name: READ, status: "done" });
    stream.send("done", { audience: { id: MADE } });
    stream.close();
    await settle();
    expect(sent(PUT_DEFAULT).map((c) => c.body)).toEqual([{ audienceId: MADE }]);
    expect(await screen.findByText(newChatsUse("@nia.tests"))).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("left after the write answered but before the stream closed: the toast says so, nothing navigates", async () => {
    const { leave } = await startLeavable();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(sent(PUT_DEFAULT)).toHaveLength(1);
    leave();
    await settle();
    expect(await screen.findByText(newChatsUse("@nia.tests"))).toBeInTheDocument();
    stream.close();
    await settle();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getAllByText(newChatsUse("@nia.tests"))).toHaveLength(1);
  });

  it("left, and the write is refused: the toast says that instead; nothing navigates", async () => {
    refuse.set(PUT_DEFAULT, 500);
    const { leave } = await startLeavable();
    leave();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(await screen.findByText(S.switchFailed)).toBeInTheDocument();
    expect(screen.queryByText(newChatsUse("@nia.tests"))).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("left, and the session has expired: the session dialog, no refusal toast", async () => {
    refuse.set(PUT_DEFAULT, 401);
    const { leave } = await startLeavable();
    leave();
    stream.send("done", { audience: { id: MADE } });
    await settle();
    expect(raised).toBe(1);
    expect(screen.queryByText(S.switchFailed)).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("left after too little to read: nothing is written", async () => {
    const { leave } = await startLeavable();
    leave();
    stream.send("fallback", { reason: "thin" });
    await settle();
    expect(sent(PUT_DEFAULT)).toEqual([]);
  });

  it("came back while it still runs: Build for the same handle sends nothing, the form stays, a toast says Maven is still reading it", async () => {
    const { leave } = await startLeavable();
    leave();
    show("own");
    type("@Nia.Tests");
    press();
    await settle();
    expect(await screen.findByText(stillReading("nia.tests"))).toBeInTheDocument();
    expect(sent(CALIBRATE)).toHaveLength(1);
    expect(screen.getByRole("button", { name: S.build })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: S.building })).toBeNull();
  });

  it("a description already being built: the toast says Maven is still building that audience", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const tree = (here: boolean) => (
      <QueryClientProvider client={client}>
        <ToastProvider>{here ? <NewAudienceNext initialDoor="describe" prefill="" inUse={false} /> : null}</ToastProvider>
      </QueryClientProvider>
    );
    const view = render(tree(true));
    type("Busy parents who meal-prep");
    press();
    await settle();
    act(() => view.rerender(tree(false)));
    act(() => view.rerender(tree(true)));
    type("Busy parents who meal-prep");
    press();
    expect(await screen.findByText(S.stillBuilding)).toBeInTheDocument();
    expect(sent(CALIBRATE)).toHaveLength(1);
  });

  it("left, and the write answered: the audience page now on screen is asked to read itself again", async () => {
    const heard = vi.fn();
    renderHook(() => useAudienceChangedElsewhere(heard));
    let open!: () => void;
    putGate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const { leave } = await startLeavable();
    leave();
    stream.send("done", { audience: { id: MADE } });
    stream.close();
    await settle();
    // The read ended with its page gone: said once.
    expect(heard).toHaveBeenCalledTimes(1);
    open();
    await settle();
    // And once more when the new audience became the default.
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe("NewAudienceNext: too little to read", () => {
  async function thin(door: NewDoor, value: string) {
    show(door);
    type(value);
    press();
    await settle();
    stream.send("fallback", { reason: "thin", message: "We couldn't read enough from @nia.tests to calibrate a personal audience …" });
    await settle();
  }

  it("the title, the sentence, Use general viewers: to /audience, nothing written", async () => {
    await thin("own", "nia.tests");
    expect(screen.getByRole("heading", { level: 2, name: S.thinTitle })).toBeInTheDocument();
    expect(screen.getByText("@nia.tests doesn't have enough public videos to read yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: S.useGeneral }));
    expect(router.push).toHaveBeenCalledWith("/audience");
    await settle();
    expect(calls.map((c) => c.key)).toEqual([CALIBRATE]);
  });

  it("Try another account: the form again, the field emptied and focused", async () => {
    await thin("other", "leo.makes");
    fireEvent.click(screen.getByRole("button", { name: S.tryAnother }));
    const handle = screen.getByRole("textbox", { name: S.otherField });
    expect(handle).toHaveValue("");
    expect(document.activeElement).toBe(handle);
    expect(screen.getByRole("radio", { name: S.doorOther })).toBeChecked();
  });

  it("a description's: Change the description, its field emptied and focused", async () => {
    await thin("describe", "Busy parents who meal-prep");
    expect(screen.getByText("There weren't enough videos for that description yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: S.changeDescription }));
    const text = screen.getByRole("textbox", { name: S.describeField });
    expect(text).toHaveValue("");
    expect(document.activeElement).toBe(text);
  });

  it("a creator who already has an audience in use: Try another account alone, as the main button (general viewers is not what they use)", async () => {
    show("own", "", true);
    type("nia.tests");
    press();
    await settle();
    stream.send("fallback", { reason: "thin" });
    await settle();
    expect(screen.queryByRole("button", { name: S.useGeneral })).toBeNull();
    const another = screen.getByRole("button", { name: S.tryAnother });
    expect(another.className).toMatch(/bg-action/);
    fireEvent.click(another);
    expect(screen.getByRole("textbox", { name: S.ownField })).toHaveValue("");
  });

  it("is clean for axe", async () => {
    await thin("own", "nia.tests");
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe("NewAudienceNext: a failed read", () => {
  it("Try another account: back to the form with what was typed, focused, to correct it; nothing is sent", async () => {
    await startOwn("nia.tset");
    stream.send("error", { message: null });
    await settle();
    expect(screen.getByRole("button", { name: S.tryAgain })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: S.tryAnother }));
    const handle = screen.getByRole("textbox", { name: S.ownField });
    expect(handle).toHaveValue("nia.tset");
    expect(document.activeElement).toBe(handle);
    expect(screen.getByRole("radio", { name: S.doorOwn })).toBeChecked();
    await settle();
    expect(sent(CALIBRATE)).toHaveLength(1);
  });

  it("a description's failure: Change the description keeps the text", async () => {
    show("describe");
    type("Busy parents who meal-prep");
    press();
    await settle();
    stream.send("error", { message: null });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: S.changeDescription }));
    expect(screen.getByRole("textbox", { name: S.describeField })).toHaveValue("Busy parents who meal-prep");
  });

  it("an expired session (a 401): the session dialog alone; the form comes back as it was, with no sentence about the account", async () => {
    refuse.set(CALIBRATE, 401);
    await startOwn();
    expect(raised).toBe(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox", { name: S.ownField })).toHaveValue("nia.tests");
    expect(screen.getByRole("button", { name: S.build })).toBeInTheDocument();
    expect(leaving()).toBe(false);
  });

  it("the server's synthesis sentence, and Try again sends the same request again", async () => {
    await startOwn();
    stream.send("error", { message: SYNTHESIS, retry: true });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent(SYNTHESIS);
    stream = madeUpStream();
    fireEvent.click(screen.getByRole("button", { name: S.tryAgain }));
    await settle();
    expect(sent(CALIBRATE).map((c) => c.body)).toEqual([buildRequestOf("own", "nia.tests"), buildRequestOf("own", "nia.tests")]);
    expect(screen.getByRole("heading", { level: 2, name: S.building })).toBeInTheDocument();
  });

  it("the route's old wording: the local sentence", async () => {
    await startOwn();
    stream.send("error", { message: "Calibration failed. Check the handle and try again.", retry: true });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent(S.accountNotFound);
  });

  it("a refused request: the local sentence, and the page is no longer held", async () => {
    refuse.set(CALIBRATE, 500);
    await startOwn();
    expect(screen.getByRole("alert")).toHaveTextContent(S.accountNotFound);
    expect(leaving()).toBe(false);
  });

  it("is clean for axe", async () => {
    await startOwn();
    stream.send("error", { message: null });
    await settle();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
