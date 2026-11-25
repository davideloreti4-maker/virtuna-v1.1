/** @vitest-environment happy-dom */
/**
 * edit-answer.test.tsx — the edit's card in its chat (plan 2026-11-24-editor-screens-a, Task 4; spec §3 screen 13, §6): it reads
 * the edit from `GET /api/edit/edits/[id]` (the network stood in, answered with a view of a real edit) every time it is shown,
 * so it is never out of date; its one primary opens the editor. And the turn that holds it offers no chat chips.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { EDIT_ID, viewOf } from "@/components/editor/__tests__/views";
import { renderWithClient } from "@/test/render-with-client";
import { EditAnswer, editedWords } from "../edit-answer";
import { ThreadTurnNext } from "../thread-turn-next";

const BLOCK = { type: "edit" as const, props: { editId: EDIT_ID } };

/** What the route answers next: a status and a body, or no answer at all (offline). */
type Answer = { status: number; body: unknown } | "offline";
let next: Answer = "offline";
let reads = 0;

function answer(status: number, body: unknown) {
  next = { status, body };
}

function standIn() {
  reads = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url) !== `/api/edit/edits/${EDIT_ID}`) throw new Error(`no answer for ${String(url)}`);
    reads += 1;
    if (next === "offline") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  }));
}

/** The app's one client (`src/app/(app)/providers.tsx`): a minute's cache, no refetch on focus. The card's own read overrides it. */
const appClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false } } });

/** The card on a client that outlives it: unmounted and shown again, it finds what it last read. */
const cardOn = (client: QueryClient) => render(<QueryClientProvider client={client}><EditAnswer block={BLOCK} /></QueryClientProvider>);

/** A take still on its way up: no length, no picture, no cut. */
const UPLOADING = { ...viewOf().take, status: "uploading", ms: null, posterUrl: null, previewUrl: null, asset: null };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the edit's card", () => {
  it("shows the edit as it stands: its picture, title, length, look and day, and opens the editor", async () => {
    standIn();
    answer(200, viewOf({ title: "Good morning", look: "clean" }));
    const { container } = renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    expect(screen.getByText("0:13 · Clean")).toBeInTheDocument();
    expect(screen.getByText("Edited today")).toBeInTheDocument();
    expect(container.querySelector('[data-part="thumb"] img')).toHaveAttribute("src", "https://media.test/poster.jpg");
    expect(screen.getByRole("link", { name: /Open editor/ })).toHaveAttribute("href", `/edit/${EDIT_ID}`);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("writes no length and no look before the take has a length", async () => {
    standIn();
    answer(200, viewOf({ take: UPLOADING, edit: null, look: null, head: null, shown: null, turns: [] }));
    const { container } = renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    expect(screen.getByText("Edited today")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d:\d\d/);
    expect(container.textContent).not.toMatch(/Our pick/);
  });

  it("writes the take's length alone once it has one, and no look before one is picked", async () => {
    standIn();
    answer(200, viewOf({ edit: null, look: null, head: null, shown: null, turns: [] }));
    const { container } = renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("0:13")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Our pick/);
  });

  it("says the edit is not there on a 404 only, with nothing to try again, and still offers the editor", async () => {
    standIn();
    answer(404, { error: "no such edit" });
    renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("This edit is not here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("link", { name: /Open editor/ })).toBeInTheDocument();
  });

  it("says any other failure could not be read, and reads again when asked", async () => {
    standIn();
    answer(500, { error: "something broke" });
    renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("This edit could not be read.")).toBeInTheDocument();
    expect(screen.queryByText("This edit is not here.")).toBeNull();
    expect(screen.getByRole("link", { name: /Open editor/ })).toBeInTheDocument();

    answer(200, viewOf());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    expect(screen.queryByText("This edit could not be read.")).toBeNull();
    expect(reads).toBe(2);
  });

  it("says the same when there is no answer at all", async () => {
    standIn();
    next = "offline";
    renderWithClient(<EditAnswer block={BLOCK} />);
    expect(await screen.findByText("This edit could not be read.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("is read again each time it is shown: back from the editor, the card it had, then the edit as it now stands", async () => {
    standIn();
    const client = appClient();

    answer(200, viewOf({ title: "Good morning", look: "clean" }));
    const first = cardOn(client);
    expect(await screen.findByText("0:13 · Clean")).toBeInTheDocument();
    first.unmount();

    // In the editor: a new title and another look. Then Back.
    answer(200, viewOf({ title: "Let us begin", look: "house" }));
    cardOn(client);
    expect(screen.getByText("0:13 · Clean")).toBeInTheDocument();
    expect(await screen.findByText("0:13 · Our pick")).toBeInTheDocument();
    expect(screen.getByText("Let us begin")).toBeInTheDocument();
    expect(screen.queryByText("0:13 · Clean")).toBeNull();
    expect(reads).toBe(2);
  });

  it("says an edit deleted since is not here, whatever the card had", async () => {
    standIn();
    const client = appClient();

    answer(200, viewOf());
    const first = cardOn(client);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    first.unmount();

    answer(404, { error: "no such edit" });
    cardOn(client);
    expect(screen.getByText("Good morning")).toBeInTheDocument();
    expect(await screen.findByText("This edit is not here.")).toBeInTheDocument();
    expect(screen.queryByText("Good morning")).toBeNull();
    expect(screen.queryByText(/\d:\d\d/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("says what went wrong in a status that was there before it, so a card that turns into it is read", async () => {
    standIn();
    answer(500, { error: "something broke" });
    renderWithClient(<EditAnswer block={BLOCK} />);
    // While it is read the status is there, empty: a region put in with its words is not read by every screen reader.
    const unread = screen.getByRole("status");
    expect(unread).toBeEmptyDOMElement();
    await waitFor(() => expect(unread).toHaveTextContent("This edit could not be read."));
    cleanup();

    // A card that showed its edit, and is told it is not there any more.
    const client = appClient();
    answer(200, viewOf());
    const first = cardOn(client);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    first.unmount();
    answer(404, { error: "no such edit" });
    cardOn(client);
    const gone = screen.getByRole("status");
    expect(gone).toBeEmptyDOMElement();
    await waitFor(() => expect(gone).toHaveTextContent("This edit is not here."));
  });

  it.each<[string, () => void]>([
    ["a 500", () => answer(500, { error: "something broke" })],
    ["no answer at all", () => { next = "offline"; }],
  ])("keeps showing the edit it had when a later read fails with %s: no error, nothing to try again", async (_how, fail) => {
    standIn();
    const client = appClient();

    answer(200, viewOf({ look: "clean" }));
    const first = cardOn(client);
    expect(await screen.findByText("0:13 · Clean")).toBeInTheDocument();
    first.unmount();

    // Out of signal, or the route broke. Then the card is shown again.
    fail();
    cardOn(client);
    // The second read has gone out, has failed, and the card has been told (the client tells its readers a tick later).
    await waitFor(() => {
      expect(reads).toBe(2);
      expect(client.isFetching()).toBe(0);
    });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    expect(client.getQueryCache().getAll().map((query) => query.state.status)).toEqual(["error"]);

    expect(screen.getByText("Good morning")).toBeInTheDocument();
    expect(screen.getByText("0:13 · Clean")).toBeInTheDocument();
    expect(screen.queryByText("This edit could not be read.")).toBeNull();
    expect(screen.queryByText("This edit is not here.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("is the turn's whole answer: no chat chips under it", async () => {
    standIn();
    answer(200, viewOf());
    // A plain answer drawn the same way does get its chips, so their absence under the card is the card's doing.
    const plain = renderWithClient(<ThreadTurnNext blocks={[{ type: "markdown", props: { text: "Hello." } }]} />);
    expect(screen.getByTestId("followup-row")).toBeInTheDocument();
    plain.unmount();

    renderWithClient(<ThreadTurnNext blocks={[BLOCK]} />);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });
});

describe("editedWords", () => {
  const now = new Date(2026, 10, 24, 15, 0);
  it("says today, yesterday, else the day", () => {
    expect(editedWords(new Date(2026, 10, 24, 9, 0).toISOString(), now)).toBe("Edited today");
    expect(editedWords(new Date(2026, 10, 23, 23, 0).toISOString(), now)).toBe("Edited yesterday");
    expect(editedWords(new Date(2026, 10, 12, 9, 0).toISOString(), now)).toBe("Edited Nov 12");
    expect(editedWords("not a time", now)).toBe("Edited");
  });
});
