/** @vitest-environment happy-dom */
/**
 * Earn (plan 2026-11-24-earn, step A; ruling 10), rendered for real: the container, the screen, the share
 * card, the QR, the hook through a real QueryClient and the shell store. Stand-ins only at the edges:
 * `fetch` (GET /api/earn), `navigator.clipboard`, `navigator.share` / `canShare`, the canvas (its 2D
 * context and `toBlob`), and the build-time flag (on). Every name and code is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { EarnPage } from "@/lib/earn/earn";
import { useShellStore } from "@/stores/shell-store";
import { EarnNext } from "../earn-next";
import { recordingContext, textsOf } from "./canvas-context";

const PAGE: EarnPage = { link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: "Nia Carter", joined: 3, whop: null };

let page: EarnPage;
let status: number;
let fetchMock: ReturnType<typeof vi.fn>;
let client: QueryClient;
let writeText: ReturnType<typeof vi.fn>;

/** Puts a property on the real navigator for one test (removed in afterEach). */
const added: string[] = [];
function onNavigator(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, writable: true, value });
  added.push(name);
}

beforeEach(() => {
  page = { ...PAGE };
  status = 200;
  fetchMock = vi.fn(async () => (status === 200 ? new Response(JSON.stringify(page), { status }) : new Response("{}", { status })));
  vi.stubGlobal("fetch", fetchMock);
  client = new QueryClient();
  writeText = vi.fn(async () => {});
  onNavigator("clipboard", { writeText });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const name of added.splice(0)) delete (navigator as unknown as Record<string, unknown>)[name];
  useShellStore.setState({ pushedTitle: "" });
});

const renderPage = () =>
  render(
    <QueryClientProvider client={client}>
      <EarnNext />
    </QueryClientProvider>,
  );
const ready = () => screen.findByRole("heading", { name: "Get paid for every creator you bring" });
const field = () => screen.getByRole("textbox", { name: "Your link" });
const button = (name: string) => screen.getByRole("button", { name });
const shareCard = () => document.querySelector<HTMLElement>("[data-share-card]")!;

describe("Earn: what it shows (ruling 10)", () => {
  it("the top: Your Earnings, $0 over the goal, the rate in the card's subtitle, and how many creators joined", async () => {
    renderPage();
    await ready();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your Earnings");
    const amountLine = screen.getByRole("heading", { level: 1 }).nextElementSibling!;
    expect(amountLine.textContent).toBe("$0 / $65k goal");
    expect(screen.getByText("50% of each referred creator's first month.")).toBeInTheDocument();
    expect(screen.getByText("3 creators joined through your link")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Earn 50%");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("/api/earn");
  });

  it.each([
    [0, "0 creators joined through your link"],
    [1, "1 creator joined through your link"],
  ])("joined %i: %s", async (joined, words) => {
    page = { ...PAGE, joined };
    renderPage();
    await ready();
    expect(screen.getByText(words)).toBeInTheDocument();
  });

  it("names the screen in the phone's header, and one h1 on the page", async () => {
    renderPage();
    await ready();
    expect(useShellStore.getState().pushedTitle).toBe("Earn");
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Your Earnings"]);
  });

  it("Your link: the link in a field, Copy; How it works: the three lines in order", async () => {
    renderPage();
    await ready();
    expect(field()).toHaveValue(PAGE.link);
    expect(field()).toHaveAttribute("readonly");
    expect(button("Copy")).toBeInTheDocument();
    const how = screen.getByRole("heading", { name: "How it works" }).closest("section")!;
    expect(within(how).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "1Share your link or the card.",
      "2A creator opens it and subscribes within 30 days, on the same device.",
      "3When they start paying, you earn 50% of their first month.",
    ]);
  });

  it("the share card: YOU EARN 50%, SHARED BY and the name, the QR of the link, the code; then Save image", async () => {
    renderPage();
    await ready();
    const card = shareCard();
    expect(card.textContent).toBe("MavenYOU EARN50%SHARED BYNia CarterK349Z4QP");
    expect(within(card).getByRole("img", { name: "QR code of your link" })).toBeInTheDocument();
    expect(button("Save image")).toBeInTheDocument();
  });

  it("no name: the card leaves out SHARED BY", async () => {
    page = { ...PAGE, name: null };
    renderPage();
    await ready();
    expect(shareCard().textContent).toBe("MavenYOU EARN50%K349Z4QP");
  });

  it("nothing earned and nobody joined: the EARNINGS card says No earnings yet", async () => {
    page = { ...PAGE, joined: 0 };
    renderPage();
    await ready();
    const section = screen.getByRole("heading", { name: "Earnings" }).closest("section")!;
    expect(within(section).getByText("No earnings yet")).toBeInTheDocument();
    expect(within(section).getByText("Share your link or the card.")).toBeInTheDocument();
  });

  it("creators joined: the EARNINGS card shows Earned and Creators joined (no Paid by without a payment side)", async () => {
    renderPage();
    await ready();
    const section = screen.getByRole("heading", { name: "Earnings" }).closest("section")!;
    expect(within(section).queryByText("No earnings yet")).toBeNull();
    expect([...section.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Earned", "Creators joined"]);
    expect([...section.querySelectorAll("dd")].map((dd) => dd.textContent)).toEqual(["$0", "3"]);
  });

  it("the payment side unreadable: no payouts card, no fine print about Whop", async () => {
    renderPage();
    await ready();
    expect(screen.queryByRole("heading", { name: "Get paid" })).toBeNull();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Whop|not credited/);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage();
    await ready();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up (as You's tests)
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Earn: Copy and Share", () => {
  it("Copy writes the link and says Copied for a moment, announced", async () => {
    renderPage();
    await ready();
    fireEvent.click(button("Copy"));
    await waitFor(() => expect(button("Copied")).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(PAGE.link);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    await waitFor(() => expect(button("Copy")).toBeInTheDocument(), { timeout: 3_000 });
  });

  it("no share sheet in this browser: no Share button", async () => {
    renderPage();
    await ready();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("a share sheet: Share sends the line and the link", async () => {
    const share = vi.fn(async () => {});
    onNavigator("share", share);
    renderPage();
    await ready();
    fireEvent.click(button("Share"));
    expect(share).toHaveBeenCalledWith({ text: "Simulate your videos before you post them. Try Maven:", url: PAGE.link });
  });

  it("closing the share sheet is not an error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    onNavigator("share", vi.fn(async () => Promise.reject(new DOMException("Share canceled", "AbortError"))));
    renderPage();
    await ready();
    await act(async () => {
      fireEvent.click(button("Share"));
    });
    expect(error).not.toHaveBeenCalled();
  });
});

describe("Earn: Save image", () => {
  let recorded: ReturnType<typeof recordingContext>;
  let canvases: HTMLCanvasElement[];
  let downloads: string[];
  const onClick = (event: Event) => {
    const a = event.target as HTMLAnchorElement;
    if (a.tagName === "A" && a.download) {
      downloads.push(a.download);
      event.preventDefault();
    }
  };
  beforeEach(() => {
    recorded = recordingContext();
    canvases = [];
    downloads = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      canvases.push(this);
      return recorded.ctx as never;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done: BlobCallback, type?: string) => done(new Blob(["png"], { type: type ?? "" })));
    document.addEventListener("click", onClick);
  });
  afterEach(() => document.removeEventListener("click", onClick));

  it("draws the card 1080 wide with the page's link, code and name", async () => {
    renderPage();
    await ready();
    await waitFor(() => expect(canvases.length).toBeGreaterThan(0));
    expect(canvases[0]!.width).toBe(1080);
    expect(textsOf(recorded.calls)).toEqual(["Maven", "YOU EARN", "50%", "SHARED BY", "Nia Carter", "K349Z4QP"]);
  });

  it("where the browser can share a file: the share sheet with maven-earn.png", async () => {
    const share = vi.fn(async () => {});
    onNavigator("share", share);
    onNavigator("canShare", vi.fn(() => true));
    renderPage();
    await ready();
    await act(async () => {
      fireEvent.click(button("Save image"));
    });
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [{ files }] = share.mock.calls[0] as unknown as [{ files: File[] }];
    expect(files.map((f) => f.name)).toEqual(["maven-earn.png"]);
    expect(downloads).toEqual([]);
  });

  it("where it cannot: a download named maven-earn.png", async () => {
    renderPage();
    await ready();
    await act(async () => {
      fireEvent.click(button("Save image"));
    });
    await waitFor(() => expect(downloads).toEqual(["maven-earn.png"]));
  });
});

describe("Earn: loading, failing, keyboard", () => {
  it("while it loads: the page's outline, announced, busy", async () => {
    let answer!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    await act(async () => answer(new Response(JSON.stringify(page), { status: 200 })));
    await ready();
  });

  it("a refused read: the line and Try again; it loads, and the focus lands on Copy", async () => {
    status = 500;
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load Earn. Try again.");
    status = 200;
    const again = button("Try again");
    again.focus();
    fireEvent.click(again);
    await ready();
    await waitFor(() => expect(button("Copy")).toHaveFocus());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("the controls come in reading order: the link, Copy, Share, Save image", async () => {
    onNavigator("share", vi.fn(async () => {}));
    renderPage();
    await ready();
    const order = [...document.querySelectorAll<HTMLElement>("input, button, a[href]")].map((el) => (el.tagName === "INPUT" ? "field" : el.textContent));
    expect(order).toEqual(["field", "Copy", "Share", "Save image"]);
  });

  it("every control is at least 44 tall (44 or 48 here)", async () => {
    onNavigator("share", vi.fn(async () => {}));
    renderPage();
    await ready();
    for (const el of [field(), button("Copy"), button("Share"), button("Save image")]) expect(el.className).toMatch(/(^|\s)h-1[1-2](\s|$)/);
  });
});
