/** @vitest-environment happy-dom */
/**
 * PostedSheet — "Posted it?" (plan 2026-11-24-after-posting, Task 3; spec §3.1; drawing frame 2): one
 * field, "TikTok link", and "Add link". Rendered for real with Radix underneath, through the real
 * `useAddPosted` and a real QueryClient. Stand-ins: `fetch` (the routes) and `matchMedia` (the phone's
 * bottom sheet or the desk's dialog). Every handle, id and link is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { postedKeys, type PostedPiece } from "@/hooks/queries/use-posted";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { PostedSheet } from "../posted-sheet";
import { KEY, PASTED, THREAD, deferred, json, reading, sentOf } from "./posted-fixtures";

const PIECE: PostedPiece = { kind: "text", threadId: THREAD, key: KEY };

function widthIs(view: "phone" | "desk") {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: view === "desk" && /min-width:\s*768px/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

let client: QueryClient;
let post: (body: unknown) => Response | Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  widthIs("phone");
  client = new QueryClient();
  post = () => json({ posted: reading() }, 201);
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = String(input).split("?")[0];
    if (method === "POST" && path === "/api/posted") return post(JSON.parse(String(init!.body)));
    if (method === "POST" && path === "/api/posted/refresh") return new Promise<Response>(() => {}); // a read takes its time
    if (method === "GET" && path === "/api/posted") return json({ posted: reading() });
    return json({ error: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The page around the sheet: a plain button opens it (not a Radix trigger), as the ask row does. */
function Page({ openerLeaves = false }: { openerLeaves?: boolean }) {
  const [open, setOpen] = useState(false);
  const [opener, setOpener] = useState(true);
  const fallback = useRef<HTMLHeadingElement>(null);
  return (
    <QueryClientProvider client={client}>
      {opener && (
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.focus();
            setOpen(true);
          }}
        >
          Open
        </button>
      )}
      <h2 ref={fallback} tabIndex={-1}>
        Fallback
      </h2>
      <button type="button" onClick={() => openerLeaves && setOpener(false)}>
        Leave
      </button>
      <PostedSheet open={open} onOpenChange={setOpen} piece={PIECE} returnFocus={() => fallback.current} />
    </QueryClientProvider>
  );
}

const openSheet = () => {
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);
};
const dialog = () => screen.getByRole("dialog", { name: POSTED_STRINGS.sheetTitle });
const field = () => within(dialog()).getByRole("textbox", { name: POSTED_STRINGS.field });
const addLink = () => within(dialog()).getByRole("button", { name: POSTED_STRINGS.submit });
const posts = () => sentOf(fetchMock).filter((s) => s.method === "POST" && s.url === "/api/posted");
/** Radix hands the focus back on a timer once the layer is gone. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

describe("PostedSheet on a phone", () => {
  it("a bottom sheet: the title, the line, the field (focused, labelled, with its placeholder), Add link", () => {
    render(<Page />);
    openSheet();
    expect(dialog()).toHaveAttribute("data-posted-sheet", "sheet");
    expect(dialog()).toHaveAttribute("data-side", "bottom");
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
    expect(within(dialog()).getByRole("heading", { name: POSTED_STRINGS.sheetTitle })).toBeInTheDocument();
    expect(dialog()).toHaveAccessibleDescription(POSTED_STRINGS.sheetText);
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute("placeholder", POSTED_STRINGS.placeholder);
    expect(field()).toHaveAttribute("inputmode", "url");
    expect(addLink()).toBeInTheDocument();
  });

  it("Escape closes it, sends nothing, and the focus is back on what opened it", async () => {
    render(<Page />);
    openSheet();
    fireEvent.keyDown(field(), { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PostedSheet on a desk", () => {
  beforeEach(() => widthIs("desk"));

  it("a centred dialog, not a sheet: no handle; the same content, the field focused", () => {
    render(<Page />);
    openSheet();
    expect(dialog()).toHaveAttribute("data-posted-sheet", "dialog");
    expect(document.querySelector('[data-slot="sheet-handle"]')).toBeNull();
    expect(dialog()).toHaveAccessibleDescription(POSTED_STRINGS.sheetText);
    expect(field()).toHaveFocus();
    expect(addLink()).toBeInTheDocument();
  });
});

describe.each(["phone", "desk"] as const)("PostedSheet — the link (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it.each([
    ["empty", ""],
    ["spaces only", "   "],
    ["not https", "http://www.tiktok.com/@nia.cooks/video/7301444403323456789"],
    ["another site", "https://www.youtube.com/shorts/abc123"],
    ["the bare apex", "https://tiktok.com/@nia.cooks/video/7301444403323456789"],
    ["a script", "javascript:alert(1)"],
  ])("%s: That's not a TikTok link. under the field, tied to it; nothing is sent", async (_name, text) => {
    render(<Page />);
    openSheet();
    if (text) fireEvent.change(field(), { target: { value: text } });
    fireEvent.click(addLink());
    const alert = within(dialog()).getByRole("alert");
    expect(alert).toHaveTextContent(POSTED_STRINGS.notTiktok);
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription(POSTED_STRINGS.notTiktok);
    expect(field()).toHaveFocus();
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Enter sends the link, trimmed; on success the sheet closes, the piece holds the link, focus is back on the opener", async () => {
    render(<Page />);
    openSheet();
    await userEvent.type(field(), `  ${PASTED}  {Enter}`);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts()).toEqual([{ method: "POST", url: "/api/posted", body: { kind: "text", threadId: THREAD, key: KEY, url: PASTED } }]);
    expect(client.getQueryData(postedKeys.piece(PIECE))).toEqual(reading());
    await settle();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });

  it("the opener has left by the time it closes (the ask row became the card): the focus goes to the fallback", async () => {
    render(<Page openerLeaves />);
    openSheet();
    fireEvent.change(field(), { target: { value: PASTED } });
    fireEvent.click(screen.getByRole("button", { name: "Leave", hidden: true }));
    fireEvent.click(addLink());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settle();
    expect(screen.getByRole("heading", { name: "Fallback" })).toHaveFocus();
  });

  it("while the request runs the button waits; a second click or Enter sends nothing; Escape does not close it", async () => {
    const answer = deferred<Response>();
    post = () => answer.promise;
    render(<Page />);
    openSheet();
    fireEvent.change(field(), { target: { value: PASTED } });
    act(() => {
      addLink().click();
      addLink().click();
    });
    fireEvent.submit(field().closest("form")!);
    expect(addLink()).toHaveAttribute("aria-disabled", "true");
    expect(addLink()).toHaveAttribute("aria-busy", "true");
    expect(field()).toHaveAttribute("readonly");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(dialog()).toBeInTheDocument();
    await act(async () => {});
    expect(posts()).toHaveLength(1);

    await act(async () => answer.resolve(json({ posted: reading() }, 201)));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts()).toHaveLength(1);
  });

  it.each([
    [409, { error: "already_linked" }, POSTED_STRINGS.alreadyLinked],
    [429, { error: "too_many" }, POSTED_STRINGS.tooMany],
    [400, { error: "not_tiktok" }, POSTED_STRINGS.notTiktok],
    [500, {}, POSTED_STRINGS.addFailed],
  ])("the server answers %i: its words under the field; the sheet stays, the link stays in the field", async (status, body, words) => {
    post = () => json(body, status);
    render(<Page />);
    openSheet();
    fireEvent.change(field(), { target: { value: PASTED } });
    fireEvent.click(addLink());
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(words);
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveValue(PASTED);
    expect(addLink()).not.toHaveAttribute("aria-disabled");
    expect(client.getQueryData(postedKeys.piece(PIECE))).toBeUndefined();
  });

  it("after a refusal: a change in the field clears the error; it can be sent again; Escape closes again", async () => {
    let refuse = true;
    post = () => (refuse ? json({}, 500) : json({ posted: reading() }, 201));
    render(<Page />);
    openSheet();
    fireEvent.change(field(), { target: { value: PASTED } });
    fireEvent.click(addLink());
    await within(dialog()).findByRole("alert");
    fireEvent.change(field(), { target: { value: `${PASTED} ` } });
    expect(within(dialog()).queryByRole("alert")).toBeNull();
    expect(field()).not.toHaveAttribute("aria-invalid");
    refuse = false;
    fireEvent.click(addLink());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts()).toHaveLength(2);
  });

  it("opened again: an empty field, no error", async () => {
    render(<Page />);
    openSheet();
    fireEvent.change(field(), { target: { value: "nope" } });
    fireEvent.click(addLink());
    fireEvent.keyDown(field(), { key: "Escape" });
    await settle();
    openSheet();
    expect(field()).toHaveValue("");
    expect(within(dialog()).queryByRole("alert")).toBeNull();
  });

  it("no axe violations, open, with an error showing", async () => {
    render(<Page />);
    openSheet();
    fireEvent.click(addLink());
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up (as You's tests)
    expect(await axe(dialog())).toHaveNoViolations();
  });
});

describe("PostedSheet — a video", () => {
  it("sends { kind: video, analysisId, url }", async () => {
    const VIDEO: PostedPiece = { kind: "video", analysisId: "44444444-4444-4444-8444-444444444444" };
    function VideoPage() {
      const [open, setOpen] = useState(true);
      return (
        <QueryClientProvider client={client}>
          <PostedSheet open={open} onOpenChange={setOpen} piece={VIDEO} />
        </QueryClientProvider>
      );
    }
    render(<VideoPage />);
    fireEvent.change(field(), { target: { value: PASTED } });
    fireEvent.click(addLink());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts()[0]!.body).toEqual({ kind: "video", analysisId: VIDEO.analysisId, url: PASTED });
  });
});
