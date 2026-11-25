/** @vitest-environment happy-dom */
/**
 * YouNext — You with its data (plan 2026-11-24-you, Tasks 5 and 6): the real screen, the real hooks
 * through TanStack Query, the real shell store. Stand-ins only at the edges: `fetch` (a small server
 * whose rows a PATCH or DELETE changes, so a refetch reads what was saved), the router, the build-time
 * flag (on), and for an account's More `matchMedia` (the phone's sheet) and the page's clock
 * (`performance.now`: the confirming Disconnect waits 500 ms). The QueryClient has the app's query
 * defaults without retries, so a refused request is an error at once.
 *
 * A request can be held (`hold`) and answered later (`release`): a held GET reads the rows as they
 * were when it arrived, as a real read sent before a write does; a held PATCH changes them only once
 * answered.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/you", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }));

import { queryKeys } from "@/lib/queries/query-keys";
import { YouNext } from "../you-next";

interface Call { method: string; url: string; body: unknown }
let calls: Call[];
let server: {
  profile: Record<string, unknown>;
  creator: Record<string, unknown>;
  you: Record<string, unknown>;
  refuse: Set<string>;
};
let answer: (call: Call) => Response | Promise<Response>;
let holding: Set<string>;
let waiting: Map<string, Array<() => void>>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const AVATAR = "https://cdn.example.test/avatars/nia.png";

function defaultAnswer(call: Call): Response {
  const key = `${call.method} ${call.url}`;
  if (server.refuse.has(key)) return json({ error: "Failed" }, 500);
  // An account's Make primary and Disconnect, by the server's rules: the primary listed first, then
  // the others oldest first (here: in the order listed); a primary that leaves hands the mark to the oldest.
  const account = /^\/api\/connected-accounts\/([\w-]+)$/.exec(call.url);
  if (account) {
    const list = server.you.accounts as Array<{ id: string; primary: boolean }>;
    if (!list.some((a) => a.id === account[1])) return json({ error: "not_found" }, 404);
    if (call.method === "PATCH") {
      const marked = list.map((a) => ({ ...a, primary: a.id === account[1] }));
      server.you.accounts = [...marked.filter((a) => a.primary), ...marked.filter((a) => !a.primary)];
      return json({ ok: true });
    }
    if (call.method === "DELETE") {
      const gone = list.find((a) => a.id === account[1])!;
      const rest = list.filter((a) => a.id !== account[1]);
      server.you.accounts = gone.primary ? rest.map((a, i) => ({ ...a, primary: i === 0 })) : rest;
      return new Response(null, { status: 204 });
    }
  }
  switch (key) {
    case "GET /api/profile":
      return json(server.profile);
    case "GET /api/profile/creator-profile":
      return json(server.creator);
    case "GET /api/you":
      return json(server.you);
    case "PATCH /api/profile/creator-profile":
      Object.assign(server.creator, call.body as object);
      return json({ success: true });
    case "PATCH /api/profile":
      server.profile.name = (call.body as { display_name: string }).display_name;
      return json({ success: true });
    case "POST /api/profile/avatar":
      server.profile.avatar = AVATAR;
      return json({ url: AVATAR });
    default:
      return json({ error: "Not found" }, 404);
  }
}

/** Requests to `key` ("PATCH /api/profile") wait until `release(key)` answers them, oldest first. */
const hold = (key: string) => holding.add(key);
const release = async (key: string) => {
  const next = waiting.get(key)?.shift();
  if (!next) throw new Error(`nothing held for ${key}`);
  await act(async () => next());
};

beforeEach(() => {
  calls = [];
  holding = new Set();
  waiting = new Map();
  server = {
    profile: { name: "Nia Test", email: "nia@example.com", company: "", role: "", avatar: null, notifications: {} },
    creator: { niche_primary: "food-cooking", niche_sub: "meal-prep", primary_goal: "conversion", about: "Nursing student.", sells: null, writing_voice_description: null, can_film: null, never_do: null },
    you: {
      // No sync time on an account (rulings 4 and 10).
      accounts: [{ id: "00000000-0000-4000-8000-000000000001", platform: "tiktok", handle: "nia.tests", primary: true }],
      followers: 12400,
      read: { contentDescription: "Budget meal prep for students.", context: "Fast, friendly.", handle: "nia.tests", readAt: null },
    },
    refuse: new Set(),
  };
  answer = defaultAnswer;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? "GET",
        url: String(input).split("?")[0]!,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : (init?.body ?? null),
      };
      calls.push(call);
      const key = `${call.method} ${call.url}`;
      if (!holding.has(key)) return answer(call);
      // A read reads the rows as they are now; a write changes them only once answered.
      const early = call.method === "GET" ? answer(call) : null;
      return new Promise<Response>((resolve) => {
        const queue = waiting.get(key) ?? [];
        queue.push(() => resolve(early ?? answer(call)));
        waiting.set(key, queue);
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let clients: QueryClient[] = [];
afterEach(() => {
  // A client with the app's defaults may still be retrying a refused read: its retries are called off.
  for (const client of clients) client.clear();
  clients = [];
});

/** `app`: the app's own client (`(app)/providers.tsx`), which keeps the library's three retries. */
function renderYou({ app = false }: { app?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: app
      ? { queries: { staleTime: 60_000, refetchOnWindowFocus: false } }
      : { queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const view = render(
    <QueryClientProvider client={client}>
      <YouNext />
    </QueryClientProvider>,
  );
  return { ...view, client };
}
const ready = () => screen.findByRole("heading", { name: "In your words" });
const rowButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\b`) });
const field = (name: string) => screen.getByRole("textbox", { name });
const sent = (method: string, url: string) => calls.filter((c) => c.method === method && c.url === url);

describe("YouNext", () => {
  it("loads, then shows who, what was read, the rows and the accounts", async () => {
    renderYou();
    expect(screen.getByTestId("you-next").querySelector('[aria-busy="true"]')).not.toBeNull();
    await ready();
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia Test @nia\.tests · 12\.4K followers/ })).toBeInTheDocument();
    expect(screen.getByText("Budget meal prep for students.")).toBeInTheDocument();
    expect(screen.getByText("Fast, friendly.")).toBeInTheDocument();
    expect(screen.getByText("Read from @nia.tests")).toBeInTheDocument();
    expect(rowButton("Niche")).toHaveTextContent("Food & Cooking · Meal Prep");
    expect(rowButton("About you")).toHaveTextContent("Nursing student.");
    expect(rowButton("What you sell")).toHaveTextContent("Add");
    expect(rowButton("Goal")).toHaveTextContent("Sell");
    expect(screen.getByText("@nia.tests")).toBeInTheDocument();
    // An account row's second line is the platform's name alone (rulings 4 and 10).
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.queryByText(/synced/)).toBeNull();
  });

  it("a fact saves alone, the row shows it, and it survives the refetch", async () => {
    renderYou();
    await ready();
    fireEvent.click(rowButton("What you sell"));
    fireEvent.change(field("What you sell"), { target: { value: " A 12-week plan. " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(sent("PATCH", "/api/profile/creator-profile").map((c) => c.body)).toEqual([{ sells: "A 12-week plan." }]);
    await waitFor(() => expect(sent("GET", "/api/profile/creator-profile")).toHaveLength(2));
    expect(rowButton("What you sell")).toHaveTextContent("A 12-week plan.");
  });

  it("the row closes on the saved text, never the old one: not even after a read that landed while the save was out", async () => {
    const { client } = renderYou();
    await ready();
    hold("PATCH /api/profile/creator-profile");
    fireEvent.click(rowButton("About you"));
    fireEvent.change(field("About you"), { target: { value: "Nurse, two kids." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    // While the save is out, the entry is read again and the read lands first, with the old text.
    await act(async () => {
      void client.invalidateQueries({ queryKey: queryKeys.profile.creatorProfile() });
    });
    await waitFor(() => expect(sent("GET", "/api/profile/creator-profile")).toHaveLength(2));
    expect(field("About you")).toHaveValue("Nurse, two kids.");
    // The read after the save is held: what the row shows when it closes can only be the entry's.
    hold("GET /api/profile/creator-profile");
    await release("PATCH /api/profile/creator-profile");
    expect(rowButton("About you")).toHaveTextContent("Nurse, two kids.");
    expect(rowButton("About you")).not.toHaveTextContent("Nursing student.");
    expect(sent("GET", "/api/profile/creator-profile")).toHaveLength(3);
    await release("GET /api/profile/creator-profile");
    expect(rowButton("About you")).toHaveTextContent("Nurse, two kids.");
  });

  it("a refused save: the row stays open with the text and the line; cancelled, the old text is back", async () => {
    server.refuse.add("PATCH /api/profile/creator-profile");
    renderYou();
    await ready();
    fireEvent.click(rowButton("About you"));
    fireEvent.change(field("About you"), { target: { value: "Changed." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    await screen.findByText("Couldn't save. Try again.");
    expect(field("About you")).toHaveValue("Changed.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(rowButton("About you")).toHaveTextContent("Nursing student.");
  });

  it("a read that fails after a save keeps the page and the saved text", async () => {
    renderYou();
    await ready();
    server.refuse.add("GET /api/profile/creator-profile");
    fireEvent.click(rowButton("What you sell"));
    fireEvent.change(field("What you sell"), { target: { value: "A 12-week plan." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    await waitFor(() => expect(sent("GET", "/api/profile/creator-profile")).toHaveLength(2));
    // TanStack tells the page on a timer: let the refusal reach it.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.queryByText("Couldn't load this page.")).toBeNull();
    expect(rowButton("What you sell")).toHaveTextContent("A 12-week plan.");
  });

  it("a blank text clears the fact", async () => {
    renderYou();
    await ready();
    fireEvent.click(rowButton("About you"));
    fireEvent.change(field("About you"), { target: { value: "   " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(sent("PATCH", "/api/profile/creator-profile").map((c) => c.body)).toEqual([{ about: null }]);
    expect(rowButton("About you")).toHaveTextContent("Add");
  });

  it("niche and goal save their columns", async () => {
    renderYou();
    await ready();
    fireEvent.click(rowButton("Niche"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Beauty · Makeup" })));
    fireEvent.click(rowButton("Goal"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Grow" })));
    expect(sent("PATCH", "/api/profile/creator-profile").map((c) => c.body)).toEqual([
      { niche_primary: "beauty", niche_sub: "makeup" },
      { primary_goal: "growth" },
    ]);
    expect(rowButton("Niche")).toHaveTextContent("Beauty · Makeup");
    expect(rowButton("Goal")).toHaveTextContent("Grow");
  });

  it("the name saves through the profile route", async () => {
    renderYou();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    fireEvent.change(field("Name"), { target: { value: "Nia T" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(sent("PATCH", "/api/profile").map((c) => c.body)).toEqual([{ display_name: "Nia T" }]);
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia T\b/ })).toBeInTheDocument();
  });

  it("a photo that lands while the name is saving does not bring the old name back", async () => {
    const { container } = renderYou();
    await ready();
    hold("POST /api/profile/avatar");
    hold("PATCH /api/profile");
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    await act(async () =>
      fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "me.png", { type: "image/png" })] } }),
    );
    fireEvent.change(field("Name"), { target: { value: "Nia T" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    // The photo is taken first: its upload reads the profile again, before the name is written.
    await release("POST /api/profile/avatar");
    await waitFor(() => expect(sent("GET", "/api/profile")).toHaveLength(2));
    hold("GET /api/profile");
    await release("PATCH /api/profile");
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia T\b/ })).toBeInTheDocument();
    expect(sent("GET", "/api/profile")).toHaveLength(3);
    await release("GET /api/profile");
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia T\b/ })).toBeInTheDocument();
  });

  it("a refused photo shows the route's reason", async () => {
    answer = (call) => (call.url === "/api/profile/avatar" ? json({ error: "File too large. Maximum size is 2MB." }, 400) : defaultAnswer(call));
    const { container } = renderYou();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    const file = new File(["x"], "me.png", { type: "image/png" });
    await act(async () => fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } }));
    expect(await screen.findByText("File too large. Maximum size is 2MB.")).toBeInTheDocument();
    expect(sent("POST", "/api/profile/avatar")).toHaveLength(1);
  });

  it("a photo refused for another reason: the save line, never the route's words", async () => {
    answer = (call) => (call.url === "/api/profile/avatar" ? json({ error: "Failed to upload avatar" }, 500) : defaultAnswer(call));
    const { container } = renderYou();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    await act(async () =>
      fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "me.png", { type: "image/png" })] } }),
    );
    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
    expect(screen.queryByText("Failed to upload avatar")).toBeNull();
  });

  it("connect: a refusal is shown; a connect closes the row and reads the page again", async () => {
    let refuse = true;
    answer = (call) =>
      call.url === "/api/connected-accounts/connect"
        ? refuse
          ? json({ error: "We couldn't read that account. Check the handle and try again." }, 502)
          : json({ account: { id: "00000000-0000-4000-8000-000000000002" } })
        : defaultAnswer(call);
    renderYou();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    fireEvent.change(field("Instagram @handle"), { target: { value: "@nia.tests.kitchen" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    expect(await screen.findByText("We couldn't read that account. Check the handle and try again.")).toBeInTheDocument();
    refuse = false;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    await waitFor(() => expect(sent("GET", "/api/you")).toHaveLength(2));
    expect(sent("POST", "/api/connected-accounts/connect").map((c) => c.body)).toEqual([
      { platform: "instagram", handle: "nia.tests.kitchen" },
      { platform: "instagram", handle: "nia.tests.kitchen" },
    ]);
    // The connect resolves once the page is read again (`useConnectAccount`): then the row closes.
    expect(await screen.findByRole("button", { name: "Connect an account" })).toBeInTheDocument();
  });

  it("no account before: after a connect that worked, the connect card is never shown again", async () => {
    const LINE = "Connect your account. Maven reads what you make and writes like it.";
    server.you = { accounts: [], followers: null, read: null };
    answer = (call) => {
      if (call.url !== "/api/connected-accounts/connect") return defaultAnswer(call);
      const account = { id: "00000000-0000-4000-8000-000000000002", platform: "tiktok", handle: "nia.tests", primary: true };
      server.you = { ...server.you, accounts: [account] };
      return json({ account: { id: account.id } });
    };
    renderYou();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    fireEvent.change(field("TikTok @handle"), { target: { value: "nia.tests" } });
    let shown = false;
    const watch = new MutationObserver(() => {
      if (document.body.textContent?.includes(LINE)) shown = true;
    });
    watch.observe(document.body, { childList: true, subtree: true, characterData: true });
    hold("GET /api/you");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    await waitFor(() => expect(sent("GET", "/api/you")).toHaveLength(2));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    // The connect is not over until the account is read back: the form is still reading.
    expect(screen.getByRole("button", { name: "Reading @nia.tests…" })).toBeInTheDocument();
    await release("GET /api/you");
    const accounts = (await screen.findByRole("heading", { name: "Accounts" })).parentElement!;
    expect(within(accounts).getByText("@nia.tests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
    watch.disconnect();
    expect(shown).toBe(false);
    expect(screen.queryByText(LINE)).toBeNull();
  });

  it("no account: the connect card and 'No account connected'", async () => {
    server.you = { accounts: [], followers: null, read: null };
    renderYou();
    await ready();
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia Test No account connected$/ })).toBeInTheDocument();
    expect(screen.getByText("Connect your account. Maven reads what you make and writes like it.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
  });

  it("an account Maven has not read yet: the card that says so, with Set up audience", async () => {
    server.you = { ...server.you, read: null };
    renderYou();
    await ready();
    expect(screen.getByText("Maven hasn't read @nia.tests yet. It reads an account when you set up its audience.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up audience" })).toHaveAttribute("href", "/audience/new");
  });

  it("a read whose account was disconnected: the read card, with its own handle", async () => {
    server.you = { accounts: [], followers: null, read: { contentDescription: "Budget meal prep for students.", context: null, handle: "nia.tests.old", readAt: null } };
    renderYou();
    await ready();
    expect(screen.getByText("Read from @nia.tests.old")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia Test No account connected$/ })).toBeInTheDocument();
  });

  it("accounts that did not load: the line, and Try again reads them again", async () => {
    server.refuse.add("GET /api/you");
    renderYou();
    expect(await screen.findByText("Couldn't load your accounts.")).toBeInTheDocument();
    server.refuse.delete("GET /api/you");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(await screen.findByText("@nia.tests")).toBeInTheDocument();
  });

  it("the accounts' Try again keeps the page: an open row keeps its text while they load", async () => {
    server.refuse.add("GET /api/you");
    renderYou();
    expect(await screen.findByText("Couldn't load your accounts.")).toBeInTheDocument();
    fireEvent.click(rowButton("About you"));
    fireEvent.change(field("About you"), { target: { value: "Nurse, two kids." } });
    server.refuse.delete("GET /api/you");
    hold("GET /api/you");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    // TanStack tells the page on a timer: let it.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(sent("GET", "/api/you")).toHaveLength(2);
    // While they load: no placeholders, the line stays, the row too.
    expect(screen.getByTestId("you-next").querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByText("Couldn't load your accounts.")).toBeInTheDocument();
    expect(field("About you")).toHaveValue("Nurse, two kids.");
    await release("GET /api/you");
    expect(await screen.findByText("@nia.tests")).toBeInTheDocument();
    expect(field("About you")).toHaveValue("Nurse, two kids.");
  });

  it("a profile that did not load: the page says so and tries again", async () => {
    server.refuse.add("GET /api/profile/creator-profile");
    renderYou();
    expect(await screen.findByText("Couldn't load this page.")).toBeInTheDocument();
    server.refuse.delete("GET /api/profile/creator-profile");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    await ready();
  });

  it("the page left while a save is out: nothing throws or warns, and the entry ends with the saved text", async () => {
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    const { client, unmount } = renderYou();
    await ready();
    hold("PATCH /api/profile/creator-profile");
    fireEvent.click(rowButton("What you sell"));
    fireEvent.change(field("What you sell"), { target: { value: "A 12-week plan." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    unmount();
    await release("PATCH /api/profile/creator-profile");
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(client.getQueryData(queryKeys.profile.creatorProfile())).toMatchObject({ sells: "A 12-week plan." });
    expect(server.creator.sells).toBe("A 12-week plan.");
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    errors.mockRestore();
    warnings.mockRestore();
  });

  it("two saves of different keys in quick succession both land: the first's re-read, still out, cannot show the second's old text", async () => {
    renderYou();
    await ready();
    // The reads after each save are held: the first's carries the row before the second save.
    hold("GET /api/profile/creator-profile");
    fireEvent.click(rowButton("About you"));
    fireEvent.change(field("About you"), { target: { value: "Nurse, two kids." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    fireEvent.click(rowButton("What you sell"));
    fireEvent.change(field("What you sell"), { target: { value: "A 12-week plan." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(sent("PATCH", "/api/profile/creator-profile").map((c) => c.body)).toEqual([{ about: "Nurse, two kids." }, { sells: "A 12-week plan." }]);
    await release("GET /api/profile/creator-profile");
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(rowButton("About you")).toHaveTextContent("Nurse, two kids.");
    expect(rowButton("What you sell")).toHaveTextContent("A 12-week plan.");
    await release("GET /api/profile/creator-profile");
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(rowButton("About you")).toHaveTextContent("Nurse, two kids.");
    expect(rowButton("What you sell")).toHaveTextContent("A 12-week plan.");
  });

  it("on the app's client, a refused first load says so at once (its retries go on behind it)", async () => {
    server.refuse.add("GET /api/profile/creator-profile");
    renderYou({ app: true });
    expect(await screen.findByText("Couldn't load this page.")).toBeInTheDocument();
    // Said on the first refusal, not after the library's three retries (about 7 s).
    expect(sent("GET", "/api/profile/creator-profile")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("on the app's client, a retry behind the line that goes through simply shows the page", async () => {
    server.refuse.add("GET /api/profile/creator-profile");
    renderYou({ app: true });
    expect(await screen.findByText("Couldn't load this page.")).toBeInTheDocument();
    server.refuse.delete("GET /api/profile/creator-profile");
    expect(await screen.findByRole("heading", { name: "In your words" }, { timeout: 4_000 })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this page.")).toBeNull();
  });

  it("on the app's client, Try again brings the page once the server answers", async () => {
    server.refuse.add("GET /api/profile");
    renderYou({ app: true });
    expect(await screen.findByText("Couldn't load this page.")).toBeInTheDocument();
    server.refuse.delete("GET /api/profile");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(await screen.findByRole("heading", { name: "In your words" }, { timeout: 4_000 })).toBeInTheDocument();
  });

  it("a connect that worked keeps the accounts and the line when their re-read fails", async () => {
    answer = (call) => (call.url === "/api/connected-accounts/connect" ? json({ account: { id: "00000000-0000-4000-8000-000000000002" } }) : defaultAnswer(call));
    renderYou();
    await ready();
    server.refuse.add("GET /api/you");
    fireEvent.click(screen.getByRole("button", { name: "Connect an account" }));
    fireEvent.change(field("TikTok @handle"), { target: { value: "nia.tests.kitchen" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect" })));
    await waitFor(() => expect(sent("GET", "/api/you")).toHaveLength(2));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.queryByText("Couldn't load your accounts.")).toBeNull();
    expect(screen.getByText("@nia.tests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia Test @nia\.tests · 12\.4K followers/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect an account" })).toBeInTheDocument();
  });

  it("no saved name: the heading shows the email, and the name opens empty with it as the placeholder", async () => {
    server.profile.name = "";
    renderYou();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo: nia@example\.com @nia\.tests/ }));
    expect(field("Name")).toHaveValue("");
    expect(field("Name")).toHaveAttribute("placeholder", "nia@example.com");
    // Saved empty: nothing is sent.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(sent("PATCH", "/api/profile")).toHaveLength(0);
    fireEvent.change(field("Name"), { target: { value: "Nia T" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    expect(sent("PATCH", "/api/profile").map((c) => c.body)).toEqual([{ display_name: "Nia T" }]);
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia T @nia\.tests/ })).toBeInTheDocument();
  });

  it("a saved name: the name opens holding it", async () => {
    renderYou();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /^Edit name and photo/ }));
    expect(field("Name")).toHaveValue("Nia Test");
  });

  it("nothing on the page reaches a paid route, and only these requests are made", async () => {
    renderYou();
    await ready();
    fireEvent.click(rowButton("Never"));
    fireEvent.change(field("Never"), { target: { value: "No giveaways." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
    for (const call of calls) {
      expect(call.url).not.toMatch(/\/api\/(tools|analyze|account-read)\b/);
      expect(call.url).toMatch(ALLOWED);
    }
  });
});

/** The requests these two tests may see: the name, the profile, the page, and an account's own route. */
const ALLOWED = /^\/api\/(profile|profile\/creator-profile|you|connected-accounts\/[0-9a-f-]{36})$/;

// ─── An account's More (Task 6) ──────────────────────────────────────────────

const PRIMARY_ID = "00000000-0000-4000-8000-000000000001";
/** A second account, not the primary (no sync time: rulings 4 and 10). */
const KITCHEN = { id: "00000000-0000-4000-8000-000000000002", platform: "instagram", handle: "nia.tests.kitchen", primary: false };
/** `matchMedia` as a phone answers it (under 768): an account's More opens a bottom sheet. */
const phone = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
/** Radix hands the focus back on a timer once a layer is gone; TanStack tells the page on one too. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const moreOf = (handle: string) => screen.getByRole("button", { name: `More: @${handle}` });
/** The question step's last row: the confirming Disconnect. */
const confirmingDisconnect = () => screen.getAllByRole("button", { name: "Disconnect" }).at(-1)!;
/** The page's clock moves on (`performance.now`, stood in): past the confirming Disconnect's 500 ms. */
const later = (ms: number) => vi.advanceTimersByTime(ms);
/** The account rows, top to bottom: "@handle", with "*" on the primary. */
const accountOrder = () =>
  within(screen.getByRole("heading", { name: "Accounts" }).parentElement!)
    .getAllByRole("listitem")
    .flatMap((li) => {
      const handle = Array.from(li.querySelectorAll("span")).find((s) => s.children.length === 0 && s.textContent?.startsWith("@"))?.textContent;
      return handle ? [`${handle}${within(li).queryByText("Primary") ? "*" : ""}`] : [];
    });
const disconnectFrom = async (handle: string) => {
  fireEvent.click(moreOf(handle));
  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
  later(600);
  await act(async () => fireEvent.click(confirmingDisconnect()));
};

describe("YouNext — an account's More", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation(phone);
    // Only the clock: TanStack's, Radix's and React's timers stay real.
    vi.useFakeTimers({ toFake: ["performance"] });
    server.you.accounts = [...(server.you.accounts as object[]), KITCHEN];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Make primary: one PATCH for that account; the mark moves and the row goes first at once; the focus stays on its More", async () => {
    hold(`PATCH /api/connected-accounts/${KITCHEN.id}`);
    renderYou();
    await ready();
    expect(accountOrder()).toEqual(["@nia.tests*", "@nia.tests.kitchen"]);
    moreOf("nia.tests.kitchen").focus();
    fireEvent.click(moreOf("nia.tests.kitchen"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make primary" })));
    await settle();
    expect(sent("PATCH", `/api/connected-accounts/${KITCHEN.id}`).map((c) => c.body)).toEqual([{ is_primary: true }]);
    expect(accountOrder()).toEqual(["@nia.tests.kitchen*", "@nia.tests"]);
    expect(moreOf("nia.tests.kitchen")).toHaveFocus();
    await release(`PATCH /api/connected-accounts/${KITCHEN.id}`);
    await waitFor(() => expect(sent("GET", "/api/you")).toHaveLength(2));
    await settle();
    expect(accountOrder()).toEqual(["@nia.tests.kitchen*", "@nia.tests"]);
    expect(moreOf("nia.tests.kitchen")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("Make primary refused: the mark goes back and the page says so; the focus stays on that row's More", async () => {
    server.refuse.add(`PATCH /api/connected-accounts/${KITCHEN.id}`);
    renderYou();
    await ready();
    moreOf("nia.tests.kitchen").focus();
    fireEvent.click(moreOf("nia.tests.kitchen"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make primary" })));
    expect(sent("PATCH", `/api/connected-accounts/${KITCHEN.id}`).map((c) => c.body)).toEqual([{ is_primary: true }]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't make @nia.tests.kitchen primary. Try again."));
    await settle();
    expect(accountOrder()).toEqual(["@nia.tests*", "@nia.tests.kitchen"]);
    expect(screen.getAllByText("Primary")).toHaveLength(1);
    expect(moreOf("nia.tests.kitchen")).toHaveFocus();
  });

  it("Disconnect, asked twice: one DELETE for that account; the row leaves at once and the focus goes to Connect an account", async () => {
    hold(`DELETE /api/connected-accounts/${KITCHEN.id}`);
    renderYou();
    await ready();
    fireEvent.click(moreOf("nia.tests.kitchen"));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(sent("DELETE", `/api/connected-accounts/${KITCHEN.id}`)).toHaveLength(0);
    later(600);
    await act(async () => fireEvent.click(confirmingDisconnect()));
    await settle();
    expect(sent("DELETE", `/api/connected-accounts/${KITCHEN.id}`)).toHaveLength(1);
    expect(screen.queryByText("@nia.tests.kitchen")).toBeNull();
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
    await release(`DELETE /api/connected-accounts/${KITCHEN.id}`);
    await waitFor(() => expect(sent("GET", "/api/you")).toHaveLength(2));
    await settle();
    expect(accountOrder()).toEqual(["@nia.tests*"]);
    expect(sent("DELETE", `/api/connected-accounts/${KITCHEN.id}`)).toHaveLength(1);
  });

  it("a double tap on Disconnect (the second press on the confirming one, inside 500 ms) sends nothing: the account stays", async () => {
    renderYou();
    await ready();
    fireEvent.click(moreOf("nia.tests.kitchen"));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }), { detail: 1 });
    later(100);
    await act(async () => fireEvent.click(confirmingDisconnect(), { detail: 2 }));
    later(300);
    await act(async () => fireEvent.click(confirmingDisconnect()));
    await settle();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
    // Still asking; past the window the confirm goes, once.
    later(200);
    await act(async () => fireEvent.click(confirmingDisconnect()));
    await settle();
    expect(sent("DELETE", `/api/connected-accounts/${KITCHEN.id}`)).toHaveLength(1);
  });

  it("the primary disconnected: the other account takes the mark at once, and Who names it", async () => {
    renderYou();
    await ready();
    await disconnectFrom("nia.tests");
    await settle();
    expect(sent("DELETE", `/api/connected-accounts/${PRIMARY_ID}`)).toHaveLength(1);
    expect(accountOrder()).toEqual(["@nia.tests.kitchen*"]);
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia Test @nia\.tests\.kitchen/ })).toBeInTheDocument();
  });

  it("Disconnect refused: the row comes back in its place and the page says so", async () => {
    server.refuse.add(`DELETE /api/connected-accounts/${KITCHEN.id}`);
    renderYou();
    await ready();
    await disconnectFrom("nia.tests.kitchen");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't disconnect @nia.tests.kitchen. Try again."));
    await settle();
    expect(accountOrder()).toEqual(["@nia.tests*", "@nia.tests.kitchen"]);
    expect(sent("DELETE", `/api/connected-accounts/${KITCHEN.id}`)).toHaveLength(1);
  });

  it("two disconnects out at once, the first refused: that row comes back and the page says so; the other still leaves (and hands it the mark)", async () => {
    hold(`DELETE /api/connected-accounts/${KITCHEN.id}`);
    hold(`DELETE /api/connected-accounts/${PRIMARY_ID}`);
    renderYou();
    await ready();
    await disconnectFrom("nia.tests.kitchen");
    await settle();
    await disconnectFrom("nia.tests");
    await settle();
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
    server.refuse.add(`DELETE /api/connected-accounts/${KITCHEN.id}`);
    await release(`DELETE /api/connected-accounts/${KITCHEN.id}`);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't disconnect @nia.tests.kitchen. Try again."));
    // The primary's disconnect is still out: by the server's rule the row that came back takes the mark.
    expect(accountOrder()).toEqual(["@nia.tests.kitchen*"]);
    expect(screen.queryByText("@nia.tests")).toBeNull();
    await release(`DELETE /api/connected-accounts/${PRIMARY_ID}`);
    await waitFor(() => expect(sent("GET", "/api/you")).toHaveLength(2));
    await settle();
    expect(accountOrder()).toEqual(["@nia.tests.kitchen*"]);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't disconnect @nia.tests.kitchen. Try again.");
  });

  it("the next action clears the line", async () => {
    server.refuse.add(`PATCH /api/connected-accounts/${KITCHEN.id}`);
    renderYou();
    await ready();
    fireEvent.click(moreOf("nia.tests.kitchen"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make primary" })));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't make @nia.tests.kitchen primary. Try again."));
    await settle();
    server.refuse.delete(`PATCH /api/connected-accounts/${KITCHEN.id}`);
    fireEvent.click(moreOf("nia.tests.kitchen"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make primary" })));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("the last account disconnected, nothing read: no Accounts section, and the focus on the card's Connect", async () => {
    server.you = { accounts: [{ id: PRIMARY_ID, platform: "tiktok", handle: "nia.tests", primary: true }], followers: 12400, read: null };
    renderYou();
    await ready();
    await disconnectFrom("nia.tests");
    await settle();
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
    expect(screen.getByRole("button", { name: "Connect" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^Edit name and photo: Nia Test No account connected$/ })).toBeInTheDocument();
  });

  it("the last account disconnected, with a read: no Accounts section, and the focus on the quiet Connect an account", async () => {
    server.you = { ...server.you, accounts: [{ id: PRIMARY_ID, platform: "tiktok", handle: "nia.tests", primary: true }] };
    renderYou();
    await ready();
    await disconnectFrom("nia.tests");
    await settle();
    expect(screen.queryByRole("heading", { name: "Accounts" })).toBeNull();
    expect(screen.getByText("Read from @nia.tests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect an account" })).toHaveFocus();
  });

  it("an account's More reaches only that account's route, nothing paid", async () => {
    renderYou();
    await ready();
    fireEvent.click(moreOf("nia.tests.kitchen"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make primary" })));
    await settle();
    await disconnectFrom("nia.tests");
    await settle();
    expect(sent("PATCH", `/api/connected-accounts/${KITCHEN.id}`)).toHaveLength(1);
    expect(sent("DELETE", `/api/connected-accounts/${PRIMARY_ID}`)).toHaveLength(1);
    for (const call of calls) {
      expect(call.url).not.toMatch(/\/api\/(tools|analyze|account-read)\b/);
      expect(call.url).toMatch(ALLOWED);
    }
  });
});
