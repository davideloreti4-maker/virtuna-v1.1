/** @vitest-environment happy-dom */
/**
 * export-ready.test.tsx — the export in the page and its Ready sheet (plan 2026-11-24-editor-screens-a, Task 14; spec E6, E20,
 * E21; rulings R2, R25, R28): how long it has left in words, the bar, Cancel; a Cancel answered with the edit back or, when the
 * file was made first, with the file; then "Save to Photos" on a touch screen that shares files (the file fetched once the sheet
 * is open, let go when it closes, given up after a minute, and handed over inside the tap), else "Download". The device's share
 * sheet (`navigator.share`, `navigator.canShare`), its pointer (`matchMedia`) and the film's address (`fetch`) are stood in.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportShown } from "@/lib/edit/edit-view";
import { START, pageStateOf, reduce } from "../edit-session";
import { ExportPanel, exportLine } from "../export-panel";
import { FILM_FETCH_MS, ReadySheet, canShareFiles, filmLine, madeFilm } from "../ready-sheet";
import { viewOf } from "./views";

const FILM = "https://media.test/films/film-1.mp4?signed=1";
/** The same film's address as a later read signs it. */
const FILM_AGAIN = "https://media.test/films/film-1.mp4?signed=2";
const FILM_2 = "https://media.test/films/film-2.mp4?signed=1";

const RUNNING: ExportShown = { job: "job-1", turn: 1, status: "running", stage: "drawing", progress: 0.4, error: null, filmUrl: null, ms: null };
const DONE: ExportShown = { ...RUNNING, status: "done", stage: null, progress: 1, filmUrl: FILM, ms: 11_300 };

/** The test window's own `matchMedia`, put back after each test. */
const MATCH_MEDIA = Object.getOwnPropertyDescriptor(window, "matchMedia");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
  if (MATCH_MEDIA) Object.defineProperty(window, "matchMedia", MATCH_MEDIA);
  else Reflect.deleteProperty(window, "matchMedia");
});

/** The device's main pointer: a finger (a phone, a tablet), or a mouse or a trackpad. */
function pointer(coarse: boolean) {
  const media = (query: string) => ({
    matches: coarse && query === "(pointer: coarse)", media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: media });
}

/** A share sheet that takes files; `share` stands in for it. */
function sharesFiles(share: (data: ShareData) => Promise<void>) {
  const shared = vi.fn(share);
  Object.defineProperty(navigator, "canShare", { configurable: true, value: (data?: ShareData) => !!data?.files?.length });
  Object.defineProperty(navigator, "share", { configurable: true, value: shared });
  return shared;
}

/** A phone: a touch screen whose share sheet takes files. */
function phone(share: (data: ShareData) => Promise<void> = async () => undefined) {
  pointer(true);
  return sharesFiles(share);
}

/** A desk whose share sheet takes files too (Safari on a Mac, Chrome on Windows): a mouse or a trackpad. */
function desk() {
  pointer(false);
  return sharesFiles(async () => undefined);
}

const film = () => new Response(new Blob([new Uint8Array(8)], { type: "binary/octet-stream" }));

/** The film's address, answered when the test says so. */
function slowFilm() {
  let answer: (response: Response) => void = () => {};
  const got = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>((resolve) => (answer = resolve)));
  vi.stubGlobal("fetch", got);
  return { got, answer: (response: Response) => act(async () => answer(response)) };
}

const sharedFiles = (share: ReturnType<typeof phone>, call = 0) =>
  (share.mock.calls[call]?.[0] as ShareData).files?.map((file) => [file.name, file.type, file.size]);

const sheet = (over: Partial<Parameters<typeof ReadySheet>[0]> = {}) => (
  <ReadySheet open onOpenChange={() => {}} job="job-1" filmUrl={FILM} poster={null} seconds={11.3} sound {...over} />
);

describe("the export in the page", () => {
  it("says how long it has left, never a percentage alone", () => {
    expect(exportLine(11.3, 0.5)).toBe("Under a minute left. You can leave, it keeps going.");
    expect(exportLine(150, 0)).toBe("About 3 minutes left. You can leave, it keeps going.");
    expect(exportLine(60, 0)).toBe("About a minute left. You can leave, it keeps going.");
    // A progress out of its bounds says neither more than the whole nor less than nothing.
    expect(exportLine(150, -1)).toBe(exportLine(150, 0));
    expect(exportLine(150, 2)).toBe("Under a minute left. You can leave, it keeps going.");
  });

  it("shows the bar and gives the edit back on Cancel, once", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<ExportPanel shown={RUNNING} filmSeconds={11.3} onCancel={onCancel} cancelling={false} />);
    expect(screen.getByRole("heading", { name: "Making your video" })).toBeInTheDocument();
    expect(screen.getByText("Under a minute left. You can leave, it keeps going.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Your video" })).toHaveAttribute("aria-valuenow", "40");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // While the cancel is out, Cancel rests.
    rerender(<ExportPanel shown={{ ...RUNNING, progress: 1.4 }} filmSeconds={11.3} onCancel={onCancel} cancelling />);
    expect(screen.getByRole("progressbar", { name: "Your video" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("after Cancel lands on the edit, or on the file when it was made first (R25)", () => {
    const cancelling = reduce(reduce(START, { type: "read", view: viewOf({ export: RUNNING }) }), { type: "start", working: { what: "cancel" } });
    expect(pageStateOf(cancelling, null)).toBe("exporting");

    // Given up in time: the edit lets go of its export, and the edit is back.
    const given = reduce(cancelling, { type: "answered", view: viewOf({ export: null }) });
    expect(pageStateOf(given, null)).toBe("ready");
    expect(madeFilm(given.view?.export ?? null)).toBeNull();

    // Made before the cancel arrived: the edit keeps the file, and it is offered.
    const kept = reduce(cancelling, { type: "answered", view: viewOf({ export: DONE }) });
    expect(pageStateOf(kept, null)).toBe("ready");
    expect(madeFilm(kept.view?.export ?? null)).toEqual({ job: "job-1", url: FILM });

    // An export that failed, or still at work, has no file to offer.
    expect(madeFilm({ ...RUNNING, status: "failed", error: "the creator cancelled it" })).toBeNull();
    expect(madeFilm(RUNNING)).toBeNull();
  });
});

describe("the Ready sheet", () => {
  it("says what was made", () => {
    expect(filmLine(11.3, true)).toBe("0:11 · 1080 × 1920 · with sound");
    expect(filmLine(75, false)).toBe("1:15 · 1080 × 1920 · no sound");
    expect(canShareFiles(undefined)).toBe(false);
    expect(canShareFiles({ canShare: () => true })).toBe(true);
    expect(canShareFiles({ canShare: () => false })).toBe(false);
    expect(canShareFiles({ canShare: () => { throw new Error("no"); } })).toBe(false);
    expect(canShareFiles({} as Pick<Navigator, "canShare">)).toBe(false);
  });

  it("offers Download where the device shares no files, and fetches nothing", () => {
    const got = vi.fn(async () => film());
    vi.stubGlobal("fetch", got);
    const onOpenChange = vi.fn();
    render(sheet({ onOpenChange }));
    expect(screen.getByRole("heading", { name: "Ready" })).toBeInTheDocument();
    expect(screen.getByText("Your video is ready")).toBeInTheDocument();
    expect(screen.getByText("0:11 · 1080 × 1920 · with sound")).toBeInTheDocument();
    const download = screen.getByRole("link", { name: "Download" });
    expect(download).toHaveAttribute("href", FILM);
    expect(download).toHaveAttribute("download", "video.mp4");
    expect(screen.queryByRole("button", { name: /Save to Photos/ })).toBeNull();
    expect(got).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back to the edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange.mock.calls).toEqual([[false], [false]]);
  });

  it("offers Download on a desk whose share sheet takes files, and fetches nothing (R28)", () => {
    const share = desk();
    const got = vi.fn(async () => film());
    vi.stubGlobal("fetch", got);
    render(sheet());
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", FILM);
    expect(screen.queryByRole("button", { name: /Save to Photos|Getting your video/ })).toBeNull();
    expect(got).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it("offers Save to Photos on a touch screen whose share sheet takes files (R28)", async () => {
    phone();
    vi.stubGlobal("fetch", vi.fn(async () => film()));
    render(sheet());
    expect(await screen.findByRole("button", { name: "Save to Photos" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it("gives up a fetch that has not ended after a minute: the request stopped, Download offered (R28)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const share = phone();
    const { got } = slowFilm();
    render(sheet());
    const signal = got.mock.calls[0]?.[1]?.signal;

    await act(async () => {
      vi.advanceTimersByTime(FILM_FETCH_MS - 1);
    });
    expect(screen.getByRole("button", { name: "Getting your video…" })).toBeDisabled();
    expect(signal?.aborted).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", FILM);
    expect(screen.queryByRole("button", { name: /Save to Photos|Getting your video/ })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(got).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
  });

  it("on a phone fetches the file first, says so meanwhile, and hands it to the share sheet inside the tap", async () => {
    const share = phone();
    const { got, answer } = slowFilm();
    render(sheet());
    expect(got).toHaveBeenCalledTimes(1);
    expect(got.mock.calls[0]?.[0]).toBe(FILM);

    // Still being fetched: the button says so and waits; a tap shares nothing.
    const waiting = screen.getByRole("button", { name: "Getting your video…" });
    expect(waiting).toBeDisabled();
    fireEvent.click(waiting);
    expect(share).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();

    await answer(film());
    const save = await screen.findByRole("button", { name: "Save to Photos" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    // Called in the tap itself, nothing awaited first: the browser allows a share only during the creator's gesture.
    expect(share).toHaveBeenCalledTimes(1);
    expect(sharedFiles(share)).toEqual([["video.mp4", "video/mp4", 8]]);
  });

  it("fetches nothing while the sheet is closed, the file once it is opened, and lets the file go when it closes (R31)", async () => {
    const share = phone();
    const { got, answer } = slowFilm();
    const { rerender } = render(sheet({ open: false }));
    expect(got).not.toHaveBeenCalled();
    rerender(sheet({ open: true }));
    expect(got).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Getting your video…" })).toBeDisabled();
    await answer(film());
    fireEvent.click(screen.getByRole("button", { name: "Save to Photos" }));
    expect(share).toHaveBeenCalledTimes(1);
    // Closed: the file is let go. Opened again: fetched again, and the button waits for it meanwhile.
    rerender(sheet({ open: false }));
    rerender(sheet({ open: true }));
    expect(got).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Getting your video…" })).toBeDisabled();
    await answer(film());
    expect(screen.getByRole("button", { name: "Save to Photos" })).toBeEnabled();
  });

  it("stops a fetch the sheet was closed during, and says nothing of it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    phone();
    const { got } = slowFilm();
    const { rerender } = render(sheet());
    const signal = got.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    rerender(sheet({ open: false }));
    expect(signal?.aborted).toBe(true);
    await act(async () => {});
    expect(warn).not.toHaveBeenCalled();
  });

  it("says nothing when the creator closes the share sheet without saving", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const share = phone(async () => {
      throw new DOMException("Share canceled", "AbortError");
    });
    vi.stubGlobal("fetch", vi.fn(async () => film()));
    render(sheet());
    fireEvent.click(await screen.findByRole("button", { name: "Save to Photos" }));
    await act(async () => {});
    expect(share).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
    // Tried again, it shares again.
    fireEvent.click(screen.getByRole("button", { name: "Save to Photos" }));
    expect(share).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("changes nothing on a second tap while the share sheet is still open", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let open = false;
    const share = phone(() => {
      if (open) return Promise.reject(new DOMException("A share is already in progress", "InvalidStateError"));
      open = true;
      return new Promise<void>(() => {});
    });
    vi.stubGlobal("fetch", vi.fn(async () => film()));
    render(sheet());
    const save = await screen.findByRole("button", { name: "Save to Photos" });
    fireEvent.click(save);
    fireEvent.click(save);
    await act(async () => {});
    expect(share).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Save to Photos" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("offers Download when the share sheet refuses the file", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    phone(async () => {
      throw new DOMException("Not allowed", "NotAllowedError");
    });
    vi.stubGlobal("fetch", vi.fn(async () => film()));
    render(sheet());
    fireEvent.click(await screen.findByRole("button", { name: "Save to Photos" }));
    expect(await screen.findByRole("link", { name: "Download" })).toHaveAttribute("href", FILM);
    expect(screen.queryByRole("button", { name: /Save to Photos/ })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to Download when the file cannot be fetched", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    phone();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    render(sheet());
    expect(await screen.findByRole("link", { name: "Download" })).toHaveAttribute("href", FILM);
    expect(screen.queryByRole("button", { name: /Save to Photos|Getting your video/ })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to Download when the film's address refuses the fetch", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    phone();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    render(sheet());
    expect(await screen.findByRole("link", { name: "Download" })).toHaveAttribute("href", FILM);
  });

  it("fetches an export's file once, however often its address is signed anew; another export's anew", async () => {
    const share = phone();
    const got = vi.fn(async () => film());
    vi.stubGlobal("fetch", got);
    const { rerender } = render(sheet());
    await screen.findByRole("button", { name: "Save to Photos" });
    rerender(sheet({ filmUrl: FILM_AGAIN }));
    rerender(sheet({ filmUrl: FILM }));
    expect(screen.getByRole("button", { name: "Save to Photos" })).toBeEnabled();
    expect(got).toHaveBeenCalledTimes(1);

    rerender(sheet({ job: "job-2", filmUrl: FILM_2 }));
    expect(screen.getByRole("button", { name: "Getting your video…" })).toBeDisabled();
    await screen.findByRole("button", { name: "Save to Photos" });
    expect(got).toHaveBeenCalledTimes(2);
    expect((got.mock.calls as unknown as [string][])[1]?.[0]).toBe(FILM_2);
    fireEvent.click(screen.getByRole("button", { name: "Save to Photos" }));
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("stops fetching a file nobody will share", async () => {
    phone();
    const { got } = slowFilm();
    const { unmount } = render(sheet());
    const signal = got.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(got).toHaveBeenCalledTimes(1));
  });
});
