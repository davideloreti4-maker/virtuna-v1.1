/** @vitest-environment happy-dom */
/**
 * Earn, step B (rulings 13, 16, 17 and 23), rendered for real: the container, the screen, the card
 * `Get paid`, the hooks through a real QueryClient. Stood in for: `fetch` (GET /api/earn and
 * POST /api/earn/whop), `navigator.clipboard`, the canvas, and the build-time flag (on). Every name, code
 * and username is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { EarnPage, EarnWhop } from "@/lib/earn/earn";
import { useShellStore } from "@/stores/shell-store";
import { EarnNext } from "../earn-next";

const BASE: EarnPage = { link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: "Nia Carter", joined: 3, whop: null };
const NEW: EarnWhop = { canEnrol: true, knownAccount: false, username: null, earnedCents: null };
const enrolledAs = (username: string, earnedCents: number | null = null): EarnWhop => ({ ...NEW, username, earnedCents });

let page: EarnPage;
let posts: unknown[];
let answer: (body: unknown) => Promise<Response>;
let client: QueryClient;

beforeEach(() => {
  page = { ...BASE, whop: NEW };
  posts = [];
  answer = async (body) => {
    const username = (body as { username?: string }).username ?? "nia.cooks";
    return new Response(JSON.stringify({ ...page, whop: { ...page.whop!, username: username.replace(/^@/, "") } }), { status: 200 });
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/earn/whop") {
        const body = JSON.parse(String(init?.body));
        posts.push(body);
        return answer(body);
      }
      return new Response(JSON.stringify(page), { status: 200 });
    }),
  );
  Object.defineProperty(navigator, "clipboard", { configurable: true, writable: true, value: { writeText: vi.fn(async () => {}) } });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  client = new QueryClient();
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).clipboard;
  useShellStore.setState({ pushedTitle: "" });
});

const renderPage = async () => {
  const view = render(
    <QueryClientProvider client={client}>
      <EarnNext />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "Get paid for every creator you bring" });
  return view;
};
const card = () => screen.getByRole("heading", { name: "Get paid" }).closest("section")!;
const inCard = () => within(card());
const field = () => inCard().getByRole("textbox", { name: "Whop username" });
const howLines = () =>
  within(screen.getByRole("heading", { name: "How it works" }).closest("section")!)
    .getAllByRole("listitem")
    .map((li) => li.textContent);
const LEAD = "Whop, our payment partner, pays your share to your Whop account.";
const NOT_CREDITED = "Sales made before you set this up are not credited.";

describe("Get paid: its three states (rulings 13 and 17)", () => {
  it("anyone not yet enrolled: the line, the field Whop username (yourname) and Save", async () => {
    await renderPage();
    expect(inCard().getByText(LEAD)).toBeInTheDocument();
    expect(inCard().getByText("Add your Whop username to get paid.")).toBeInTheDocument();
    expect(field()).toHaveAttribute("placeholder", "yourname");
    expect(inCard().getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(inCard().queryByRole("button", { name: "Set up payouts" })).toBeNull();
    // Ruling 43: what is not credited, said before the field, in reading order.
    expect(card().textContent).toBe(`Get paid${LEAD}${NOT_CREDITED}Add your Whop username to get paid.Whop usernameSave`);
  });

  it("a paying customer not yet enrolled: one button, Set up payouts, and no field", async () => {
    page = { ...BASE, whop: { ...NEW, knownAccount: true } };
    await renderPage();
    expect(inCard().getByText(LEAD)).toBeInTheDocument();
    expect(inCard().getByRole("button", { name: "Set up payouts" })).toBeInTheDocument();
    expect(inCard().queryByRole("textbox")).toBeNull();
    expect(card().textContent).toBe(`Get paid${LEAD}${NOT_CREDITED}Set up payouts`);
  });

  it("enrolled: who is paid and when, and a quiet Change", async () => {
    page = { ...BASE, whop: enrolledAs("nia.cooks") };
    await renderPage();
    expect(inCard().getByText("Paid by Whop to @nia.cooks, 14 to 30 days after a creator's first payment.")).toBeInTheDocument();
    expect(inCard().getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(inCard().queryByRole("textbox")).toBeNull();
    // Ruling 43: the line about earlier sales is for a creator who has not enrolled yet.
    expect(inCard().queryByText(NOT_CREDITED)).toBeNull();
  });

  it("once enrolled the line about earlier sales is gone, and Change does not bring it back", async () => {
    await renderPage();
    expect(inCard().getByText(NOT_CREDITED)).toBeInTheDocument();
    fireEvent.change(field(), { target: { value: "nia.cooks" } });
    fireEvent.click(inCard().getByRole("button", { name: "Save" }));
    const change = await inCard().findByRole("button", { name: "Change" });
    expect(inCard().queryByText(NOT_CREDITED)).toBeNull();
    fireEvent.click(change);
    await waitFor(() => expect(field()).toHaveFocus());
    expect(inCard().queryByText(NOT_CREDITED)).toBeNull();
  });

  it("Whop not configured here: Payouts aren't available yet., and nothing offered", async () => {
    page = { ...BASE, whop: { ...NEW, canEnrol: false, knownAccount: true } };
    await renderPage();
    expect(card().textContent).toBe("Get paidPayouts aren't available yet.");
    expect(inCard().queryByRole("button")).toBeNull();
    expect(inCard().queryByRole("textbox")).toBeNull();
  });

  it("the payment side unknown (whop null): no card at all", async () => {
    page = { ...BASE, whop: null };
    await renderPage();
    expect(screen.queryByRole("heading", { name: "Get paid" })).toBeNull();
  });

  it.each([
    ["the field", NEW],
    ["the button", { ...NEW, knownAccount: true }],
    ["enrolled", enrolledAs("nia.cooks", 2450)],
    ["not available", { ...NEW, canEnrol: false }],
  ])("has no accessibility violations: %s", async (_state, whop) => {
    page = { ...BASE, whop };
    const { container } = await renderPage();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up (as You's tests)
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Enrolling with a username", () => {
  it("Save sends the username without its @; the card turns to enrolled, and the focus lands on Change", async () => {
    await renderPage();
    fireEvent.change(field(), { target: { value: " @nia.cooks " } });
    fireEvent.click(inCard().getByRole("button", { name: "Save" }));
    expect(await inCard().findByText("Paid by Whop to @nia.cooks, 14 to 30 days after a creator's first payment.")).toBeInTheDocument();
    expect(posts).toEqual([{ username: "nia.cooks" }]);
    await waitFor(() => expect(inCard().getByRole("button", { name: "Change" })).toHaveFocus());
  });

  it("Enter in the field saves", async () => {
    await renderPage();
    fireEvent.change(field(), { target: { value: "nia.cooks" } });
    fireEvent.submit(field());
    await inCard().findByRole("button", { name: "Change" });
    expect(posts).toEqual([{ username: "nia.cooks" }]);
  });

  it("a text that cannot be a Whop username: the error under the field, nothing sent, the focus in the field", async () => {
    await renderPage();
    fireEvent.change(field(), { target: { value: "nia cooks" } });
    const save = inCard().getByRole("button", { name: "Save" });
    save.focus();
    fireEvent.click(save);
    const error = await inCard().findByRole("alert");
    expect(error).toHaveTextContent("We couldn't find that Whop username.");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field().getAttribute("aria-describedby")).toBe(error.id);
    expect(field()).toHaveFocus();
    expect(posts).toEqual([]);
  });

  it.each([
    [422, "not_found", "We couldn't find that Whop username."],
    [503, "not_available", "Payouts aren't available yet."],
    [409, "already_connected", "That Whop account is already connected."],
    [429, "failed", "Couldn't set up payouts. Try again."],
    [502, "failed", "Couldn't set up payouts. Try again."],
    [500, "Server error", "Couldn't set up payouts. Try again."],
  ])("a %i (%s): %s under the field; the field keeps its text", async (status, error, words) => {
    answer = async () => new Response(JSON.stringify({ error }), { status });
    await renderPage();
    fireEvent.change(field(), { target: { value: "nobody.here" } });
    fireEvent.click(inCard().getByRole("button", { name: "Save" }));
    expect(await inCard().findByRole("alert")).toHaveTextContent(words);
    expect(field()).toHaveValue("nobody.here");
    expect(inCard().queryByText(/Paid by Whop/)).toBeNull();
  });

  it("typing again clears the error", async () => {
    await renderPage();
    fireEvent.change(field(), { target: { value: "nia cooks" } });
    fireEvent.click(inCard().getByRole("button", { name: "Save" }));
    await inCard().findByRole("alert");
    fireEvent.change(field(), { target: { value: "nia.cooks" } });
    expect(inCard().queryByRole("alert")).toBeNull();
  });

  it("while it runs, Save waits (busy, the field read-only) and a second Save sends nothing", async () => {
    let release!: () => void;
    const held = answer;
    answer = (body) => new Promise<Response>((resolve) => (release = () => void held(body).then(resolve)));
    await renderPage();
    fireEvent.change(field(), { target: { value: "nia.cooks" } });
    const save = inCard().getByRole("button", { name: "Save" });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.submit(field());
    await waitFor(() => expect(save).toHaveAttribute("aria-busy", "true"));
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).not.toBeDisabled();
    expect(field()).toHaveAttribute("readonly");
    expect(posts).toHaveLength(1);
    await act(async () => release());
    await inCard().findByRole("button", { name: "Change" });
    expect(posts).toHaveLength(1);
  });
});

describe("Enrolling as a paying customer", () => {
  beforeEach(() => {
    page = { ...BASE, whop: { ...NEW, knownAccount: true } };
  });

  it("Set up payouts sends no username; enrolled, the focus on Change", async () => {
    await renderPage();
    fireEvent.click(inCard().getByRole("button", { name: "Set up payouts" }));
    await inCard().findByText(/Paid by Whop to @nia\.cooks/);
    expect(posts).toEqual([{}]);
    await waitFor(() => expect(inCard().getByRole("button", { name: "Change" })).toHaveFocus());
  });

  it.each([
    [503, "not_available", "Payouts aren't available yet."],
    [409, "already_connected", "That Whop account is already connected."],
    [422, "not_found", "Couldn't set up payouts. Try again."],
    [400, "no_account", "Couldn't set up payouts. Try again."],
  ])("a %i (%s): %s under the button, the focus kept on it", async (status, error, words) => {
    answer = async () => new Response(JSON.stringify({ error }), { status });
    await renderPage();
    const button = inCard().getByRole("button", { name: "Set up payouts" });
    button.focus();
    fireEvent.click(button);
    expect(await inCard().findByRole("alert")).toHaveTextContent(words);
    expect(button).toHaveFocus();
  });

  it("a second press while it runs sends nothing", async () => {
    let release!: () => void;
    const held = answer;
    answer = (body) => new Promise<Response>((resolve) => (release = () => void held(body).then(resolve)));
    await renderPage();
    const button = inCard().getByRole("button", { name: "Set up payouts" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    expect(posts).toHaveLength(1);
    await act(async () => release());
    await inCard().findByRole("button", { name: "Change" });
  });
});

describe("Change (ruling 13): the same enrolment with a new username", () => {
  beforeEach(() => {
    page = { ...BASE, whop: enrolledAs("nia.cooks") };
  });

  it("opens the field with the focus in it; Save enrols the new username", async () => {
    await renderPage();
    fireEvent.click(inCard().getByRole("button", { name: "Change" }));
    await waitFor(() => expect(field()).toHaveFocus());
    fireEvent.change(field(), { target: { value: "nia.bakes" } });
    fireEvent.click(inCard().getByRole("button", { name: "Save" }));
    expect(await inCard().findByText("Paid by Whop to @nia.bakes, 14 to 30 days after a creator's first payment.")).toBeInTheDocument();
    expect(posts).toEqual([{ username: "nia.bakes" }]);
    await waitFor(() => expect(inCard().getByRole("button", { name: "Change" })).toHaveFocus());
  });

  it("Escape in the field goes back, the focus on Change, nothing sent", async () => {
    await renderPage();
    fireEvent.click(inCard().getByRole("button", { name: "Change" }));
    await waitFor(() => expect(field()).toHaveFocus());
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(inCard().getByText(/Paid by Whop to @nia\.cooks/)).toBeInTheDocument();
    await waitFor(() => expect(inCard().getByRole("button", { name: "Change" })).toHaveFocus());
    expect(posts).toEqual([]);
  });
});

describe("The earned number and How it works (rulings 16 and 17)", () => {
  it("a known number: the amount line says $24.50 over the goal; the joined line stays", async () => {
    page = { ...BASE, whop: enrolledAs("nia.cooks", 2450) };
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling!.textContent).toBe("$24.50 / $65k goal");
    expect(screen.getByText("3 creators joined through your link")).toBeInTheDocument();
  });

  it("a known zero is a number too: $0 / $65k goal", async () => {
    page = { ...BASE, whop: enrolledAs("nia.cooks", 0) };
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling!.textContent).toBe("$0 / $65k goal");
  });

  it("an unknown number: the goal alone, and no money anywhere else", async () => {
    page = { ...BASE, whop: enrolledAs("nia.cooks", null) };
    await renderPage();
    expect(screen.getByText("$65k goal")).toBeInTheDocument();
    expect(document.body.textContent!.replace("$65k goal", "")).not.toMatch(/\$/);
  });

  it("line 3 names Whop when Whop can pay", async () => {
    await renderPage();
    expect(howLines()[2]).toBe("3When they start paying, you earn 50% of their first month. Whop pays you 14 to 30 days later.");
  });

  it.each([
    ["Whop not configured", { ...NEW, canEnrol: false }],
    ["the payment side unknown", null],
  ])("line 3 says nothing of Whop: %s", async (_why, whop) => {
    page = { ...BASE, whop };
    await renderPage();
    expect(howLines()[2]).toBe("3When they start paying, you earn 50% of their first month.");
  });
});

describe("Layout and reading order", () => {
  it("two columns: the link and share card left; right, Get paid over How it works", async () => {
    await renderPage();
    const link = screen.getByRole("heading", { name: "Get paid for every creator you bring" }).closest("section")!;
    const how = screen.getByRole("heading", { name: "How it works" }).closest("section")!;
    const grid = link.parentElement!;
    expect(grid.className).toMatch(/(^|\s)gap-3(\s|$)/);
    expect(grid.className).toContain("md:grid-cols-2");
    const right = how.parentElement!;
    expect(right.parentElement).toBe(grid);
    expect(right.firstElementChild).toBe(card());
    expect(right.lastElementChild).toBe(how);
    expect(link.contains(document.querySelector("[data-share-card]"))).toBe(true);
  });

  it("without the card: the right column is How it works alone", async () => {
    page = { ...BASE, whop: null };
    await renderPage();
    const how = screen.getByRole("heading", { name: "How it works" }).closest("section")!;
    expect(how.parentElement!.children).toHaveLength(1);
  });

  it("the controls in reading order: the link, Copy, Save image, the card's field and Save", async () => {
    await renderPage();
    const order = [...document.querySelectorAll<HTMLElement>("input, button, a[href]")].map((el) => (el.tagName === "INPUT" ? `field:${el.getAttribute("aria-label") ? "link" : "whop"}` : el.textContent));
    expect(order).toEqual(["field:link", "Copy", "Save image", "field:whop", "Save"]);
  });

  it("the field and its buttons are at least 44 tall", async () => {
    await renderPage();
    for (const el of [field(), inCard().getByRole("button", { name: "Save" })]) expect(el.className).toMatch(/(^|\s)h-12(\s|$)/);
  });
});
