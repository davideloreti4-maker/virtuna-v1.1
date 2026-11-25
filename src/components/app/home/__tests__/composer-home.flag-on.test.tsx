/** @vitest-environment happy-dom */
/**
 * Home under the new look (Home plan 2026-11-23, Task 4): what the real composer draws on /home
 * while no chat is open (NEW_LOOK_ENABLED, with AMBIENT_V2 and CONCEPT_V8 on, as the dev server
 * runs). The composer hands Home its own field block, so the field's requests are the thread's.
 * Since the Home spec of 2026-11-25 that field is the thread's in its layout too (its skill
 * buttons and More), and the audience is a line under the greeting.
 *
 * Everything here is the real composer, the real Home and the real field. Stand-ins only for what
 * cannot run in a test: the network (`fetch`), the router, the storage client, object URLs, and
 * matchMedia (the setup's no-op shim, so this is the phone). The open chat is a blank new chat:
 * the active-thread cookie holds the sentinel and `/api/threads/open` answers no messages.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/flags/concept-v8", () => ({ CONCEPT_V8_ENABLED: true }));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// The storage client: nothing here uploads, but the composer reaches it on a video send.
const upload = vi.fn();
/** The session's user: none is an expired session. */
let sessionUser: { id: string } | null = { id: "u1" };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser }, error: null }) },
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => upload(bucket, ...args),
        remove: async () => ({ error: null }),
      }),
    },
  }),
}));

import { Composer } from "../composer";
import {
  ACTIVE_THREAD_COOKIE,
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  getActiveThreadCookie,
  setActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

// ── the network ──────────────────────────────────────────────────────────────
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let threadFixture: unknown = { messages: [] };
let audiencesFixture: unknown = { audiences: [] };
let threadsFixture: unknown[] = [];
/** What `/api/threads/library` answers (Home's Recent reads its first page); null: the same chats
 *  as `threadsFixture`, as plain chats. */
let libraryFixture: unknown = null;
/** The chat list's chats as Library's endpoint lists them: plain chats, nothing in them yet. */
function libraryOf(threads: unknown[]) {
  const chats = (threads as Array<{ id: string; title: string | null; updated_at: string; pinned_at: string | null }>).map((t) => ({
    id: t.id,
    title: t.title,
    updatedAt: t.updated_at,
    pinned: t.pinned_at !== null,
    summary: {
      counts: { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 },
      lead: "chat",
      stage: "chat",
      sim: null,
      frame: null,
      videoPath: null,
    },
  }));
  return { chats, next: null };
}
/** What `/api/subscription` answers (the balance). Empty: no plan, no usage. */
let subscriptionFixture: unknown = {};
/** Keep the chat stream open (the live turn stays on screen) until it is aborted. */
let holdChatOpen = false;
/** The chat route refuses (a 500): the run fails and its turn shows the error and a Retry. */
let failChat = false;
/** While set, `/api/threads/open` answers only once this settles (a reload whose load is still out). */
let openGate: Promise<void> | null = null;
/** How `/api/threads/open` fails, if it does: a 500, or the request itself rejecting. */
let openFails: "500" | "reject" | null = null;
/** Keep an Explore stream open until it is aborted. */
let holdExploreOpen = false;
/** Keep a video read's stream open until it is aborted. */
let holdAnalyzeOpen = false;
/** While set, `/api/threads/new` answers only once this settles (a send still making its chat). */
let newGate: Promise<void> | null = null;
/** While set, `/api/threads/list` (the sidebar's chat list, Home's "has chats") answers only once this settles. */
let listGate: Promise<void> | null = null;

/** A request the test settles by hand, so it can look at the screen while the request is out. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** An SSE body: ends at once, or stays open until the request's signal aborts. */
function sse(signal: AbortSignal | null | undefined, hold: boolean): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!hold) {
        controller.close();
        return;
      }
      signal?.addEventListener("abort", () =>
        controller.error(new DOMException("The operation was aborted.", "AbortError")),
      );
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}) } as unknown as Response;
}
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

function installFetch() {
  calls = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/api/tools/hooks")) return sse(init?.signal, false);
    if (url.includes("/api/analyze")) return sse(init?.signal, holdAnalyzeOpen);
    if (url.includes("/api/tools/explore")) return sse(init?.signal, holdExploreOpen);
    if (url.includes("/api/tools/chat")) {
      if (failChat) return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      return sse(init?.signal, holdChatOpen);
    }
    if (url.includes("/api/threads/open")) {
      if (openGate) await openGate;
      if (openFails === "500") return { ok: false, status: 500, json: async () => ({ error: "boom" }) } as unknown as Response;
      if (openFails === "reject") throw new TypeError("Failed to fetch");
      return json(threadFixture);
    }
    if (url.includes("/api/threads/new")) {
      if (newGate) await newGate;
      return json({ threadId: "t-new" });
    }
    if (url.includes("/api/threads/list")) {
      if (listGate) await listGate;
      return json({ threads: threadsFixture });
    }
    if (url.includes("/api/threads/library")) return json(libraryFixture ?? libraryOf(threadsFixture));
    if (url.includes("/api/audiences")) return json(audiencesFixture);
    if (url.includes("/api/subscription")) return json(subscriptionFixture);
    if (url.includes("/api/tracked-accounts")) return json({ accounts: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    if (url.includes("/api/surfaces/drops")) return json({ drops: [] });
    return json({});
  }) as typeof fetch;
}

const requests = (path: string) => calls.filter((c) => c.url.includes(path));
const bodyOf = (c: Call) => JSON.parse(String(c.init?.body ?? "{}")) as Record<string, unknown>;
/** Every request that runs a skill or makes a chat: Home spends nothing until a send. */
const spending = () =>
  calls.filter((c) => ["/api/tools/", "/api/analyze", "/api/threads/new"].some((path) => c.url.includes(path)));

// ── the page ─────────────────────────────────────────────────────────────────
const SKILLS = ["Simulate", "Hooks", "Script", "Remix"] as const;
const field = () => screen.getByTestId("thread-field");
const inField = () => within(field());
const text = () => inField().getByRole("textbox") as HTMLTextAreaElement;
const shell = () => screen.getByTestId("composer-shell");
/** The skill cards named so: the buttons of that name outside the field (its own skill buttons carry
 *  the same names) and outside an open list ("/" lists them too). */
const cardsOf = (name: (typeof SKILLS)[number]) =>
  screen.queryAllByRole("button", { name }).filter((b) => !b.closest('[data-testid="thread-field"], [role="dialog"]'));
/** A skill card (named for its skill alone). */
const card = (name: (typeof SKILLS)[number]) => {
  const [one, ...more] = cardsOf(name);
  if (!one || more.length > 0) throw new Error(`expected one card named ${name}`);
  return one;
};
/** The field's own button of that name (row 2: the skills and More). */
const pill = (name: string) => inField().getByRole("button", { name });
/** What the field shows picked: its pressed button (a skill's, or More naming an armed skill). */
const picked = () => field().querySelector<HTMLElement>('[aria-pressed="true"]');
/** Home's audience line, under the greeting, by its words ("For @handle"): its name is those words
 *  and ", change audience". */
const audienceLine = (words: string) => screen.getByRole("button", { name: `${words}, change audience` });
/** The viewport as `matchMedia` reports it: 768 and wider (the sheets' popovers). The setup's shim
 *  matches nothing, so every other test here is the phone. */
function desktop() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: /min-width:\s*768px/.test(query),
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
const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const clip = () => new File(["video-bytes"], "take.mp4", { type: "video/mp4" });

/** The composer on a blank new chat, once its open-thread load and the audiences have landed. */
async function renderHome() {
  renderWithClient(<Composer />);
  await screen.findByTestId("thread-field");
  await waitFor(() => expect(requests("/api/threads/open").length).toBeGreaterThan(0));
  await settle();
}

/** One settled exchange, in the shape `/api/threads/open` returns it. */
function chatThread() {
  const at = "2026-11-21T00:00:00.000Z";
  return {
    threadId: "t1",
    messages: [
      { id: "u1", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "What should I film first?" } }], created_at: at },
      { id: "m1", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Start with the mirror shot." } }], created_at: at },
    ],
    simSeals: {},
  };
}

/** The creator's own audience, as `/api/audiences` lists it. */
const ownAudience = (id: string, name: string) => ({
  id,
  name,
  mode: "socials",
  is_general: false,
  is_preset: false,
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  personas: [],
  source_account_id: `acct-${name}`,
});

beforeEach(() => {
  cleanup();
  threadFixture = { messages: [] };
  audiencesFixture = { audiences: [] };
  threadsFixture = [];
  libraryFixture = null;
  subscriptionFixture = {};
  holdChatOpen = false;
  failChat = false;
  openGate = null;
  openFails = null;
  holdExploreOpen = false;
  holdAnalyzeOpen = false;
  newGate = null;
  listGate = null;
  sessionUser = { id: "u1" };
  // The shell store is module state: a bump left by one test must not reach the next.
  useShellStore.setState({ fieldFocusSignal: 0, threadBack: null, threadTitleHint: null, libraryScroll: null });
  useBoardStore.setState({ activeThreadId: null });
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  installFetch();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  vi.restoreAllMocks();
});

describe("Home: /home with no chat open", () => {
  it("shows the greeting, the audience line, the thread's field as Home's card and the four skills; nothing of the old arrival, no dock", async () => {
    await renderHome();
    expect(shell()).toHaveAttribute("data-layout", "home");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/^Good (morning|afternoon|evening)/);
    // No audience of the creator's own: the general one, on its line right under the greeting.
    expect(heading.nextElementSibling).toBe(audienceLine("For a general audience"));
    expect(audienceLine("For a general audience")).toHaveTextContent(/^For a general audience$/);
    for (const name of SKILLS) expect(card(name)).toBeInTheDocument();
    expect(text().placeholder).toBe("Ask anything");
    for (const id of ["composer-chips-row", "arrival-room-line", "next-field-dock"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    // The thread's field: its skill buttons and More, none pressed, one line of text. A solid card.
    for (const name of [...SKILLS, "More"]) expect(pill(name)).toBeInTheDocument();
    expect(picked()).toBeNull();
    expect(text()).toHaveAttribute("rows", "1");
    expect(field().style.backdropFilter).toBe("");
    expect(field()).toHaveClass("bg-surface", "shadow-[var(--shadow-rest)]");
    // Nothing of Home's old field: no audience in it, no pill above the text.
    expect(inField().queryByRole("button", { name: /audience/i })).toBeNull();
    expect(field().querySelector('[data-part="picked-skill"]')).toBeNull();
  });

  it("warms no drops", async () => {
    await renderHome();
    await settle(100);
    expect(requests("/api/surfaces/drops")).toHaveLength(0);
  });

  it("a card picks its skill: the selected button in the field's row with its price, the cards stay, the text has focus; a second tap lets it go", async () => {
    await renderHome();
    const before = SKILLS.map((name) => card(name));
    fireEvent.click(card("Hooks"));
    expect(picked()).toBe(pill("Hooks"));
    expect(picked()?.textContent).toBe("Hooks · 1");
    expect(pill("Hooks")).toHaveAccessibleDescription("1 credit");
    // The thread's own words for the skill.
    expect(text().placeholder).toBe("A topic for your hooks");
    // The cards stay, the same four (spec 2026-11-25 §2.5): nothing on the page moves on a pick.
    expect(SKILLS.map((name) => card(name))).toEqual(before);
    expect(document.activeElement).toBe(text());

    fireEvent.click(pill("Hooks"));
    expect(picked()).toBeNull();
    for (const name of SKILLS) expect(card(name)).toBeInTheDocument();
    expect(text().placeholder).toBe("Ask anything");
    // A pick spends nothing: no run, no chat made.
    await settle(100);
    expect(spending()).toEqual([]);
  });

  it.each([
    ["Script", "What the script is about"],
    ["Remix", "Paste a TikTok link"],
  ] as const)("%s picked from its card: its button is the selected one, and the text asks as in a thread (%s)", async (name, words) => {
    await renderHome();
    fireEvent.click(card(name));
    expect(picked()).toBe(pill(name));
    expect(text().placeholder).toBe(words);
    expect(document.activeElement).toBe(text());
  });

  it("Simulate: the field names it at 10 credits, asks for a video or a link, and focus is on +", async () => {
    await renderHome();
    fireEvent.click(card("Simulate"));
    expect(picked()).toBe(pill("Simulate"));
    expect(picked()?.textContent).toBe("Simulate · 10");
    expect(pill("Simulate")).toHaveAccessibleDescription("10 credits");
    expect(text().placeholder).toBe("Add a video or paste a link");
    expect(document.activeElement).toBe(inField().getByRole("button", { name: "Add a video" }));
    await settle(100);
    expect(spending()).toEqual([]);
  });

  it("+ with a video: the tile shows and the field picks Simulate", async () => {
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(picked()?.textContent).toBe("Simulate · 10");
    // A staged video is not a send: nothing uploads, nothing runs.
    await settle(100);
    expect(spending()).toEqual([]);
    expect(upload).not.toHaveBeenCalled();
  });

  it("a video send that fails before its run starts goes back to Home: the error by the field, the clip still staged", async () => {
    upload.mockResolvedValue({ error: { message: "storage down" } });
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);

    // The failure has landed once its error is by the field (it shows only after the upload refused).
    await waitFor(() => expect(field().textContent).toContain("That upload didn't go through."));
    expect(upload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(screen.getByTestId("home-next")).toBeInTheDocument();
    expect(within(field()).getByRole("alert")).toHaveTextContent("That upload didn't go through.");
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(picked()?.textContent).toBe("Simulate · 10");
    expect(await screen.findByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)/ })).toBeInTheDocument();
    expect(requests("/api/analyze")).toHaveLength(0);
  });

  it("a video send on an expired session goes back to Home the same way, and uploads nothing", async () => {
    sessionUser = null;
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => expect(field().textContent).toContain("Your session expired."));
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    expect(requests("/api/analyze")).toHaveLength(0);
  });

  it("a video send whose upload throws goes back to Home too, with the upload error by the field", async () => {
    upload.mockRejectedValue(new TypeError("Failed to fetch"));
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => expect(field().textContent).toContain("That upload didn't go through."));
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(within(field()).getByRole("alert")).toHaveTextContent("That upload didn't go through.");
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(requests("/api/analyze")).toHaveLength(0);
    // Not busy any more: send is offered again for the staged clip.
    expect(field().querySelector('button[type="submit"]')).not.toBeDisabled();
  });

  it("inside a chat, a refused video upload puts the earlier question back: the failed turn and its Retry stay", async () => {
    failChat = true;
    await renderHome();
    fireEvent.change(text(), { target: { value: "hello" } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);
    // The chat's only turn: the question, then the failed run with its Retry.
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(screen.getByText("hello", { selector: "p" })).toBeInTheDocument();
    expect(shell()).toHaveAttribute("data-layout", "thread");

    upload.mockResolvedValue({ error: { message: "storage down" } });
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => expect(field().textContent).toContain("That upload didn't go through."));
    await settle();

    expect(shell()).toHaveAttribute("data-layout", "thread");
    expect(screen.queryByTestId("home-next")).toBeNull();
    expect(screen.getByText("hello", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("take.mp4", { selector: "p" })).toBeNull();
    expect(retry).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBe(retry);
  });

  it("the audience: named on the line under the greeting, its sheet opens, a tap on another persists it and renames the line", async () => {
    const first = "3f2a7c1e-5b6d-4e8f-9a0b-1c2d3e4f5a6b";
    const second = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
    audiencesFixture = { audiences: [ownAudience(first, "@nia.tests"), ownAudience(second, "@nia.cooks")], lastAudienceId: first };
    await renderHome();
    const line = await waitFor(() => audienceLine("For @nia.tests"));
    expect(line).toHaveTextContent(/^For @nia\.tests$/);
    expect(inField().queryByRole("button", { name: /audience/i })).toBeNull();
    fireEvent.click(line);
    const sheet = await screen.findByRole("dialog", { name: "Audience" });
    expect(audienceLine("For @nia.tests")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(sheet).getByRole("button", { name: "@nia.cooks" }));

    await waitFor(() => expect(requests("/api/settings/last-audience")).toHaveLength(1));
    const put = requests("/api/settings/last-audience")[0]!;
    expect(put.init?.method).toBe("PUT");
    expect(bodyOf(put)).toEqual({ audienceId: second });
    await waitFor(() => expect(audienceLine("For @nia.cooks")).toHaveTextContent(/^For @nia\.cooks$/));
    // An audience switch re-keys the drops' warm under v8; on Home it still warms nothing.
    await settle(100);
    expect(requests("/api/surfaces/drops")).toHaveLength(0);
  });

  it("the audience sheet's close hands the focus back to the line, even when the press did not focus it (Safari)", async () => {
    await renderHome();
    // A click here does not move focus: nothing had it when the sheet opened.
    fireEvent.click(audienceLine("For a general audience"));
    await screen.findByRole("dialog", { name: "Audience" });
    await settle();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog", { name: "Audience" })).toBeNull();
    expect(document.activeElement).toBe(audienceLine("For a general audience"));
    expect(document.activeElement).not.toBe(text());
  });

  it("on desktop the audience sheet is a popover centred below the line, standing on it, and its close hands the focus back to it", async () => {
    desktop();
    await renderHome();
    const line = audienceLine("For a general audience");
    line.focus();
    fireEvent.click(line);
    const sheet = await screen.findByRole("dialog", { name: "Audience" });
    await settle();
    expect(sheet).toHaveAttribute("data-side", "bottom");
    expect(sheet).toHaveAttribute("data-align", "center");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog", { name: "Audience" })).toBeNull();
    expect(document.activeElement).toBe(audienceLine("For a general audience"));

    // Which element it stands on: with the field held still, the popover follows the line when the
    // line moves. (Centring is `data-align` above: this page lays nothing out, so the popover's own
    // width is not the browser's and its centre cannot be read from here.)
    vi.spyOn(field().parentElement!, "getBoundingClientRect").mockReturnValue(new DOMRect(200, 400, 720, 96));
    const placedWith = async (x: number) => {
      vi.spyOn(line, "getBoundingClientRect").mockReturnValue(new DOMRect(x, 120, 180, 22));
      fireEvent.click(line);
      const opened = await screen.findByRole("dialog", { name: "Audience" });
      await settle();
      const across = Number(/^translate\((-?[\d.]+)px/.exec(opened.closest<HTMLElement>("[data-radix-popper-content-wrapper]")!.style.transform)![1]);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await settle();
      return across;
    };
    expect((await placedWith(500)) - (await placedWith(300))).toBe(200);
  });

  it("More opens from the field on Home; a skill picked there is named on More with its price, the text asks as in a thread", async () => {
    await renderHome();
    fireEvent.click(pill("More"));
    const more = await screen.findByRole("dialog", { name: "More" });
    fireEvent.click(within(more).getByRole("button", { name: /^Ideas/ }));
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
    expect(picked()).toBe(pill("Ideas"));
    expect(picked()?.textContent).toBe("Ideas · 1");
    expect(text().placeholder).toBe("A topic for ideas");
    expect(document.activeElement).toBe(text());
    await settle(100);
    expect(spending()).toEqual([]);
  });

  // Review minor 3. More hands focus back to what opened it once its layer has gone (Radix, on a
  // timer); the field has put the cursor in the text by then, and More leaves it there. More offers
  // no Simulate, so "+" is never the next step from here (a card's pick covers that).
  it.each([
    ["the phone, More in the field", false, () => pill("More")],
    ["the desktop, More in the field", true, () => pill("More")],
  ] as const)("on %s: a skill chosen in More leaves the cursor in the field's text once More has closed and handed back its focus", async (_where, wide, opener) => {
    if (wide) desktop();
    await renderHome();
    // Focused first, as a keyboard user's tap leaves it: More has something to hand focus back to.
    opener().focus();
    fireEvent.click(opener());
    const more = await screen.findByRole("dialog", { name: "More" });
    await settle();
    fireEvent.click(within(more).getByRole("button", { name: /^Ideas/ }));
    await settle(60);
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
    expect(picked()?.textContent).toBe("Ideas · 1");
    expect(document.activeElement).toBe(text());
  });

  it("on desktop More opens downward from the field on Home (in a thread it opens upward)", async () => {
    desktop();
    await renderHome();
    fireEvent.click(pill("More"));
    const more = await screen.findByRole("dialog", { name: "More" });
    await settle();
    expect(more).toHaveAttribute("data-side", "bottom");
  });

  it("More's Audience row on Home opens the audience sheet, whose close puts the focus on the line", async () => {
    await renderHome();
    fireEvent.click(pill("More"));
    const more = await screen.findByRole("dialog", { name: "More" });
    fireEvent.click(within(more).getByRole("button", { name: "Audience: General" }));
    await screen.findByRole("dialog", { name: "Audience" });
    await settle();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(audienceLine("For a general audience"));
  });

  it("a send from Home: one new chat, then one chat request, and the screen becomes the thread", async () => {
    holdChatOpen = true;
    await renderHome();
    expect(shell()).toHaveAttribute("data-layout", "home");
    fireEvent.change(text(), { target: { value: "hello" } });
    fireEvent.keyDown(text(), { key: "Enter" });

    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    expect(requests("/api/threads/new")).toHaveLength(1);
    expect(requests("/api/threads/new")[0]!.init?.method).toBe("POST");
    const order = (path: string) => calls.findIndex((c) => c.url.includes(path));
    expect(order("/api/threads/new")).toBeLessThan(order("/api/tools/chat"));
    expect(bodyOf(requests("/api/tools/chat")[0]!).ask).toBe("hello");

    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    expect(screen.getByTestId("next-field-dock")).toBeInTheDocument();
    expect(await screen.findByText("hello", { selector: "p" })).toBeInTheDocument();
    await settle(100);
    expect(requests("/api/threads/new")).toHaveLength(1);
    expect(requests("/api/tools/chat")).toHaveLength(1);
  });

  it("a skill send from Home: Hooks, a topic, Enter: one hooks request with that topic, then the thread", async () => {
    await renderHome();
    expect(shell()).toHaveAttribute("data-layout", "home");
    fireEvent.click(card("Hooks"));
    expect(picked()?.textContent).toBe("Hooks · 1");
    fireEvent.change(text(), { target: { value: "meal prep" } });
    fireEvent.keyDown(text(), { key: "Enter" });

    await waitFor(() => expect(requests("/api/tools/hooks")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/hooks")[0]!).ask).toBe("meal prep");
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await settle(100);
    expect(requests("/api/tools/hooks")).toHaveLength(1);
    expect(requests("/api/threads/new")).toHaveLength(1);
  });

  it("`/` opens the skills downward, under the field near the top of the page: Simulate first, no old labels", async () => {
    await renderHome();
    text().focus();
    fireEvent.change(text(), { target: { value: "/" } });
    const menu = await screen.findByRole("dialog", { name: "Skills" });
    await settle();
    expect(menu).toHaveAttribute("data-side", "bottom");
    const rows = within(menu).getAllByRole("button");
    expect(rows[0]).toHaveAccessibleName("Simulate");
    expect(rows[0]).toHaveAttribute("data-enter", "true");
    expect(menu.textContent).not.toContain("TEST");
    // Typing goes on in the field.
    expect(document.activeElement).toBe(text());
  });

  it("while the skills are open, send is off: a tap on it must not send the slash as a message", async () => {
    await renderHome();
    text().focus();
    fireEvent.change(text(), { target: { value: "/ho" } });
    await screen.findByRole("dialog", { name: "Skills" });
    expect(field().querySelector('button[type="submit"]')).toBeDisabled();
    fireEvent.change(text(), { target: { value: "hello" } });
    await waitFor(() => expect(field().querySelector('button[type="submit"]')).toBeEnabled());
  });

  it("`/ho` then Enter picks Hooks: its pill with the price, the text empty, nothing spent", async () => {
    await renderHome();
    fireEvent.change(text(), { target: { value: "/ho" } });
    const menu = await screen.findByRole("dialog", { name: "Skills" });
    expect(within(menu).getByRole("button", { name: "Hooks" })).toHaveAttribute("data-enter", "true");
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(picked()).toBe(pill("Hooks"));
    expect(picked()?.textContent).toBe("Hooks · 1");
    expect(text().value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Skills" })).toBeNull();
    await settle();
    expect(spending()).toEqual([]);
  });

  it("`/zz` then Enter, a name no skill has: nothing is picked, nothing is sent, the text stays", async () => {
    await renderHome();
    text().focus();
    fireEvent.change(text(), { target: { value: "/zz" } });
    expect(await screen.findByText("No skill by that name")).toBeInTheDocument();
    fireEvent.keyDown(text(), { key: "Enter" });
    await settle();
    expect(picked()).toBeNull();
    expect(text()).toHaveValue("/zz");
    expect(spending()).toEqual([]);
  });

  it("`/idea` then Enter picks Ideas, a skill with no card on Home", async () => {
    await renderHome();
    fireEvent.change(text(), { target: { value: "/idea" } });
    await screen.findByRole("dialog", { name: "Skills" });
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(picked()?.textContent).toBe("Ideas · 1");
    expect(text().value).toBe("");
  });

  it("Recent lists the titled chats from the chat list; a tap opens one", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    threadsFixture = [
      { id: "c1", title: "Meal prep for busy students", updated_at: at, created_at: at, pinned_at: null },
      { id: "c2", title: "Morning routine, no cuts", updated_at: at, created_at: at, pinned_at: null },
    ];
    await renderHome();
    const first = await screen.findByRole("button", { name: "Meal prep for busy students" });
    expect(screen.getByRole("button", { name: "Morning routine, no cuts" })).toBeInTheDocument();
    fireEvent.click(first);
    expect(getActiveThreadCookie()).toBe("c1");
  });

  it("Recent's rows carry Library's summary: the line under the title and the gauge to the result", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    threadsFixture = [
      { id: "c1", title: "Meal prep for busy students", updated_at: at, created_at: at, pinned_at: null },
      { id: "c2", title: "Morning routine, no cuts", updated_at: at, created_at: at, pinned_at: null },
    ];
    const plain = libraryOf(threadsFixture);
    const counts = { hooks: 3, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };
    const sim = { number: 66, measure: "stop", at, kind: "hooks", link: { type: "text", key: "k1", as: "hook" } };
    libraryFixture = {
      ...plain,
      chats: [{ ...plain.chats[0]!, summary: { ...plain.chats[0]!.summary, counts, lead: "hooks", stage: "simulated", sim } }, plain.chats[1]],
    };
    await renderHome();
    const row = await screen.findByRole("button", { name: "Meal prep for busy students" });
    await waitFor(() => expect(row).toHaveAccessibleDescription("3 hooks · simulated 2h ago"));
    expect(screen.getByRole("button", { name: "Morning routine, no cuts" })).toHaveAccessibleDescription("Chat · 2h ago");
    expect(screen.getByRole("link", { name: "Open the result: Meal prep for busy students" })).toHaveAttribute(
      "href",
      "/simulation/hook/c1/k1",
    );
    // Home reads one page of the summary and spends nothing.
    expect(requests("/api/threads/library").map((c) => c.url)).toEqual(["/api/threads/library"]);
    expect(spending()).toEqual([]);
  });
});

// ── Under the field (spec 2026-11-25 §2.5) ───────────────────────────────────
describe("Home: under the field, the chats first", () => {
  /** Whether any of the four cards was in the page at any moment since this was called: each change
   *  of the page is looked at as it happens, so a card drawn and taken away in between is caught. */
  function watchForCards() {
    let seen = false;
    const look = () => {
      if (SKILLS.some((name) => cardsOf(name).length > 0)) seen = true;
    };
    const observer = new MutationObserver(look);
    observer.observe(document.body, { childList: true, subtree: true });
    look();
    return { seen: () => (look(), seen), stop: () => observer.disconnect() };
  }

  it("a returning creator never sees the cards, not for a moment: nothing while the list is out, then Recent", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    threadsFixture = [{ id: "c1", title: "Meal prep for busy students", updated_at: at, created_at: at, pinned_at: null }];
    const list = deferred();
    listGate = list.promise;
    const cards = watchForCards();
    try {
      await renderHome();
      await settle(50);
      // The list is out: under the field, nothing at all.
      expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
      const column = screen.getByRole("heading", { level: 1 }).parentElement!;
      const fieldBlock = [...column.children].find((part) => part.contains(field()))!;
      expect(fieldBlock.nextElementSibling).toBeNull();
      await act(async () => {
        list.resolve();
      });
      expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Meal prep for busy students" })).toBeInTheDocument();
      await settle(50);
      expect(cards.seen()).toBe(false);
    } finally {
      cards.stop();
    }
  });

  it("a new creator (the list answers with no titled chat): the four cards, and a pick keeps them", async () => {
    threadsFixture = [{ id: "c0", title: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString(), pinned_at: null }];
    // Library's summary leaves an empty untitled chat out, as its endpoint does.
    libraryFixture = { chats: [], next: null };
    await renderHome();
    await waitFor(() => expect(card("Simulate")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
    fireEvent.click(card("Script"));
    expect(picked()).toBe(pill("Script"));
    for (const name of SKILLS) expect(card(name)).toBeInTheDocument();
  });

  it("Money made is not on Home at $0, and nothing holds a place for it", async () => {
    await renderHome();
    await settle(50);
    expect(screen.queryByText("Money made")).toBeNull();
    expect(document.querySelector('[data-part="money"]')).toBeNull();
  });
});

// ── The final fix round (brief 2026-11-23) ───────────────────────────────────
describe("Home: the final fix round", () => {
  it("A1: More is the field's own: there is no More skills under the cards, and Ideas picked in More spends nothing", async () => {
    await renderHome();
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
    fireEvent.click(pill("More"));
    const more = await screen.findByRole("dialog", { name: "More" });
    fireEvent.click(within(more).getByRole("button", { name: /^Ideas/ }));
    expect(picked()?.textContent).toBe("Ideas · 1");
    // The cards stay with a skill from More picked too.
    for (const name of SKILLS) expect(card(name)).toBeInTheDocument();
    await settle(100);
    expect(spending()).toEqual([]);
  });

  it("A4: an account with no plan shows no balance on Home (its skills still run)", async () => {
    subscriptionFixture = { tier: "free", isTrial: false, usage: { used: 0, limit: 0, remaining: 0, enforced: false, inTrial: false, renewsAt: null, periodStart: null } };
    await renderHome();
    await waitFor(() => expect(requests("/api/subscription").length).toBeGreaterThan(0));
    await settle(50);
    expect(screen.getByTestId("home-next").querySelector('[data-part="credits"]')).toBeNull();
    expect(screen.queryByText("0 credits")).toBeNull();
  });

  it("A4: a paid plan shows what is left", async () => {
    subscriptionFixture = { tier: "starter", isTrial: false, usage: { used: 470, limit: 500, remaining: 30, enforced: true, inTrial: false, renewsAt: null, periodStart: null } };
    await renderHome();
    expect(await screen.findByText("30 credits")).toBeInTheDocument();
  });

  it("A5: a refused upload on Home says no credits were used", async () => {
    upload.mockResolvedValue({ error: { message: "storage down" } });
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => expect(field().textContent).toContain("That upload didn't go through."));
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(within(field()).getByRole("alert")).toHaveTextContent(
      "That upload didn't go through. Check your connection and try again. No credits used.",
    );
  });

  it("A5: an expired session on a video send says no credits were used too", async () => {
    sessionUser = null;
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => expect(field().textContent).toContain("Your session expired."));
    expect(within(field()).getByRole("alert")).toHaveTextContent(/Your session expired\..* No credits used\.$/);
  });

  it("A7: the cards stay while the / list is open (it opens downward over them), and after", async () => {
    await renderHome();
    const before = SKILLS.map((name) => card(name));
    text().focus();
    fireEvent.change(text(), { target: { value: "/" } });
    await screen.findByRole("dialog", { name: "Skills" });
    // The list's own rows and the field's buttons carry the same names: a card is outside both.
    expect(SKILLS.map((name) => card(name))).toEqual(before);
    fireEvent.change(text(), { target: { value: "" } });
    expect(SKILLS.map((name) => card(name))).toEqual(before);
  });

  it("B2: a reload into a chat names it at once: while the load is out the board points at the cookie's chat", async () => {
    setActiveThreadCookie("t1");
    const open = deferred();
    openGate = open.promise;
    renderWithClient(<Composer />);
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(1));
    expect(useBoardStore.getState().activeThreadId).toBe("t1");
    threadFixture = chatThread();
    await act(async () => {
      open.resolve();
    });
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    expect(useBoardStore.getState().activeThreadId).toBe("t1");
  });

  it("B3: on Home with Explore picked there is no Search control; the field's send is the only way to run", async () => {
    await renderHome();
    fireEvent.change(text(), { target: { value: "/explore" } });
    await screen.findByRole("dialog", { name: "Skills" });
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(picked()?.textContent).toMatch(/^Explore/);
    expect(shell()).toHaveAttribute("data-layout", "home");
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    // The one button named "Run Explore" is the field's send.
    const runs = screen.getAllByRole("button", { name: "Run Explore" });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveAttribute("type", "submit");
    expect(inField().getAllByRole("button", { name: "Run Explore" })).toHaveLength(1);

    fireEvent.click(runs[0]!);
    await waitFor(() => expect(requests("/api/tools/explore")).toHaveLength(1));
    const order = (path: string) => calls.findIndex((c) => c.url.includes(path));
    expect(order("/api/threads/new")).toBeLessThan(order("/api/tools/explore"));
  });

  /** A chat with content, Explore picked: its own control (Search) is over the docked field. */
  async function exploreInAChat() {
    holdExploreOpen = true;
    setActiveThreadCookie("t1");
    threadFixture = chatThread();
    renderWithClient(<Composer />);
    await screen.findByText("Start with the mirror shot.");
    fireEvent.change(text(), { target: { value: "/explore" } });
    await screen.findByRole("dialog", { name: "Skills" });
    fireEvent.keyDown(text(), { key: "Enter" });
    await screen.findByRole("button", { name: "Search" });
  }
  /** Opens Search and returns its own Run (not the field's send, whose name is also "Run Explore").
   *  Synchronous: the popover closes on Run, so a second Run means opening it again. */
  const openPopoverRun = () => {
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    return screen.getAllByRole("button", { name: "Run Explore" }).find((b) => b.getAttribute("type") !== "submit")!;
  };

  it("B3: in a chat, two quick Runs from Explore's own control, before the first request has gone out, send one", async () => {
    await exploreInAChat();
    // Both Runs land in the same task: the first run has not reached its request yet.
    fireEvent.click(openPopoverRun());
    fireEvent.click(openPopoverRun());
    await settle(100);
    expect(requests("/api/tools/explore")).toHaveLength(1);
  });

  it("follow-up 3: a Run while Explore's own stream is out restarts it with the new settings", async () => {
    await exploreInAChat();
    fireEvent.click(openPopoverRun());
    await waitFor(() => expect(requests("/api/tools/explore")).toHaveLength(1));
    await waitFor(() => expect(inField().getByRole("button", { name: "Stop the run" })).toBeInTheDocument());
    const first = requests("/api/tools/explore")[0]!;

    // New settings, Run again while the first search streams.
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Niche or keywords" }), { target: { value: "gym beginners" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Run Explore" }).find((b) => b.getAttribute("type") !== "submit")!);

    await waitFor(() => expect(requests("/api/tools/explore")).toHaveLength(2));
    expect(bodyOf(requests("/api/tools/explore")[1]!)).toMatchObject({ niche: "gym beginners" });
    // The first search was replaced, not left running beside it.
    expect((first.init?.signal as AbortSignal).aborted).toBe(true);
  });

  it.each([
    ["the sentinel (a blank new chat)", () => setActiveThreadCookie(NEW_THREAD_SENTINEL)],
    ["no pointer at all (the server picks the newest chat)", () => clearActiveThreadCookie()],
  ] as const)("B2: with %s nothing is seeded while the load is out", async (_pointer, point) => {
    point();
    useBoardStore.setState({ activeThreadId: null });
    const open = deferred();
    openGate = open.promise;
    renderWithClient(<Composer />);
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(1));
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    await act(async () => {
      open.resolve();
    });
  });
});

// ── Task 5: arriving and leaving ─────────────────────────────────────────────
const GREETING = /^Good (morning|afternoon|evening)/;
const OPENING = "Opening thread…";

describe("arriving: a reload never shows Home for a moment", () => {
  it("into a chat: while its load is out, the loading outline and no Home; then the chat", async () => {
    setActiveThreadCookie("t1");
    const open = deferred();
    openGate = open.promise;
    const onRehydratingChange = vi.fn();
    renderWithClient(<Composer onRehydratingChange={onRehydratingChange} />);

    // The first render already: the outline, no greeting, no cards.
    expect(screen.getByText(OPENING)).toBeInTheDocument();
    expect(screen.queryByTestId("home-next")).toBeNull();
    expect(onRehydratingChange.mock.calls[0]?.[0]).toBe(true);

    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(1));
    await settle();
    expect(screen.getByText(OPENING)).toBeInTheDocument();
    expect(screen.queryByTestId("home-next")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: GREETING })).toBeNull();
    expect(shell()).toHaveAttribute("data-layout", "thread");
    expect(onRehydratingChange).not.toHaveBeenCalledWith(false);

    threadFixture = chatThread();
    await act(async () => {
      open.resolve();
    });
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).toBeNull();
    expect(shell()).toHaveAttribute("data-layout", "thread");
    expect(screen.queryByTestId("home-next")).toBeNull();
    expect(onRehydratingChange).toHaveBeenLastCalledWith(false);
  });

  it("into a new chat (the sentinel): Home from the first render, before the load answers", async () => {
    const open = deferred();
    openGate = open.promise;
    const onRehydratingChange = vi.fn();
    renderWithClient(<Composer onRehydratingChange={onRehydratingChange} />);

    expect(screen.getByTestId("home-next")).toBeInTheDocument();
    expect(shell()).toHaveAttribute("data-layout", "home");
    expect(screen.queryByText(OPENING)).toBeNull();

    await act(async () => {
      open.resolve();
    });
    await settle();
    expect(shell()).toHaveAttribute("data-layout", "home");
    expect(onRehydratingChange).not.toHaveBeenCalledWith(true);
  });

  it("with no pointer at all (a new device): the outline first, then Home when the server has no chat", async () => {
    clearActiveThreadCookie();
    const open = deferred();
    openGate = open.promise;
    renderWithClient(<Composer />);

    expect(screen.getByText(OPENING)).toBeInTheDocument();
    expect(screen.queryByTestId("home-next")).toBeNull();

    await act(async () => {
      open.resolve();
    });
    expect(await screen.findByTestId("home-next")).toBeInTheDocument();
    expect(shell()).toHaveAttribute("data-layout", "home");
    expect(screen.queryByText(OPENING)).toBeNull();
    expect(await screen.findByRole("heading", { level: 1, name: GREETING })).toBeInTheDocument();
  });
});

describe("arriving: a first load that fails ends on Home (final fix B5)", () => {
  it.each([
    ["answers 500", "no pointer", "500"],
    ["answers 500", "a chat in the pointer", "500"],
    ["rejects", "no pointer", "reject"],
    ["rejects", "a chat in the pointer", "reject"],
  ] as const)("the load %s, %s: Home, never stuck on the loading outline", async (_how, pointer, fails) => {
    openFails = fails;
    if (pointer === "no pointer") clearActiveThreadCookie();
    else setActiveThreadCookie("t1");
    renderWithClient(<Composer />);
    // It starts on the outline (the first paint expects a chat) ...
    expect(screen.getByText(OPENING)).toBeInTheDocument();
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(1));
    // ... and once the load has failed, Home.
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(screen.queryByText(OPENING)).toBeNull();
    expect(await screen.findByRole("heading", { level: 1, name: GREETING })).toBeInTheDocument();
    // The chat id seeded from the cookie for the load (B2) is not left behind: Home shows, so the
    // sidebar and the phone header must not mark that chat as the current one.
    expect(useBoardStore.getState().activeThreadId).toBeNull();
  });
});

describe("leaving Home: the cursor stays where the creator types", () => {
  /** The text of the field docked under the thread. */
  const dockText = () => within(screen.getByTestId("next-field-dock")).getByRole("textbox");
  const sendButton = () => field().querySelector('button[type="submit"]') as HTMLButtonElement;

  it("a send from the keyboard: once the thread shows, the docked field's text has focus", async () => {
    holdChatOpen = true;
    await renderHome();
    text().focus();
    fireEvent.change(text(), { target: { value: "hello" } });
    fireEvent.keyDown(text(), { key: "Enter" });

    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await waitFor(() => expect(document.activeElement).toBe(dockText()));
    expect(requests("/api/tools/chat")).toHaveLength(1);
  });

  it("a send with the send button, tapped: focus is not moved to the text", async () => {
    holdChatOpen = true;
    await renderHome();
    fireEvent.change(text(), { target: { value: "hello" } });
    sendButton().focus();
    // A pointer tap (final fix B4: the pointerdown says the last input was not the keyboard).
    fireEvent.pointerDown(sendButton());
    fireEvent.click(sendButton());

    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    await settle(100);
    expect(document.activeElement).not.toBe(dockText());
  });

  it("B4: Tab to send, Enter, a message typed: once the thread shows, the docked text has focus", async () => {
    holdChatOpen = true;
    await renderHome();
    text().focus();
    fireEvent.change(text(), { target: { value: "hello" } });
    fireEvent.keyDown(text(), { key: "Tab" });
    sendButton().focus();
    // Enter on a button: its keydown, then the click it activates (detail 0).
    fireEvent.keyDown(sendButton(), { key: "Enter" });
    fireEvent.click(sendButton(), { detail: 0 });

    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await waitFor(() => expect(document.activeElement).toBe(dockText()));
    expect(requests("/api/tools/chat")).toHaveLength(1);
  });

  it("B4: a Recent row opened from the keyboard: once the chat shows, the docked text has focus", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    threadsFixture = [{ id: "t1", title: "Meal prep for busy students", updated_at: at, created_at: at, pinned_at: null }];
    await renderHome();
    threadFixture = chatThread();
    const row = await screen.findByRole("button", { name: "Meal prep for busy students" });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.click(row, { detail: 0 });
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(dockText()));
  });

  it("B4: the same row clicked with the pointer: focus is not moved to the text", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    threadsFixture = [{ id: "t1", title: "Meal prep for busy students", updated_at: at, created_at: at, pinned_at: null }];
    await renderHome();
    threadFixture = chatThread();
    const row = await screen.findByRole("button", { name: "Meal prep for busy students" });
    // Some keyboard use first (the creator typed), then a tap on the row.
    fireEvent.keyDown(text(), { key: "a" });
    fireEvent.pointerDown(row);
    fireEvent.click(row, { detail: 1 });
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    await settle(50);
    expect(document.activeElement).not.toBe(dockText());
  });

  it("an Enter that sends nothing, then a chat opened from Recent: focus is not moved to the text", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    threadsFixture = [{ id: "t1", title: "Meal prep for busy students", updated_at: at, created_at: at, pinned_at: null }];
    await renderHome();
    text().focus();
    fireEvent.keyDown(text(), { key: "Enter" }); // an empty chat message: nothing to send
    await settle();
    expect(spending()).toEqual([]);

    threadFixture = chatThread();
    // A tap (a pointerdown, then the click): a row opened from the keyboard takes the focus (B4).
    const row = await screen.findByRole("button", { name: "Meal prep for busy students" });
    fireEvent.pointerDown(row);
    fireEvent.click(row, { detail: 1 });
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    await settle(50);
    expect(document.activeElement).not.toBe(dockText());
  });

  it("Enter with a staged video, the upload refused: Home again, and the cursor is back in Home's text", async () => {
    // The upload takes a while, as over a network: the screen is the thread (the uploading card)
    // until it is refused, so the field block moves into the dock and back.
    const refusal = deferred();
    upload.mockImplementation(() => refusal.promise.then(() => ({ error: { message: "storage down" } })));
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    text().focus();
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await waitFor(() => expect(document.activeElement).toBe(dockText()));

    await act(async () => {
      refusal.resolve();
    });
    await waitFor(() => expect(field().textContent).toContain("That upload didn't go through."));
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    await settle();
    expect(document.activeElement).toBe(text());
  });

  it("the same, but the creator has moved the focus elsewhere meanwhile: it stays where they put it", async () => {
    // Something outside the composer that outlives the screen's change, as a row of the sidebar does.
    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    try {
      const refusal = deferred();
      upload.mockImplementation(() => refusal.promise.then(() => ({ error: { message: "storage down" } })));
      await renderHome();
      fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
      text().focus();
      fireEvent.keyDown(text(), { key: "Enter" });
      await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
      await waitFor(() => expect(document.activeElement).toBe(dockText()));
      elsewhere.focus();

      await act(async () => {
        refusal.resolve();
      });
      await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
      await settle();
      expect(document.activeElement).toBe(elsewhere);
    } finally {
      elsewhere.remove();
    }
  });

  it("after a send that came back to Home, a chat opened from Recent does not take the focus", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    threadsFixture = [{ id: "t1", title: "Meal prep for busy students", updated_at: at, created_at: at, pinned_at: null }];
    upload.mockResolvedValue({ error: { message: "storage down" } });
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    text().focus();
    fireEvent.keyDown(text(), { key: "Enter" });
    await waitFor(() => expect(field().textContent).toContain("That upload didn't go through."));
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    await settle();
    (document.activeElement as HTMLElement | null)?.blur();

    threadFixture = chatThread();
    // A tap (a pointerdown, then the click): a row opened from the keyboard takes the focus (B4).
    const row = await screen.findByRole("button", { name: "Meal prep for busy students" });
    fireEvent.pointerDown(row);
    fireEvent.click(row, { detail: 1 });
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    await settle(50);
    expect(document.activeElement).not.toBe(dockText());
  });

  it("New chat on a blank Home (the shell's focusField) puts the cursor in the field", async () => {
    await renderHome();
    expect(document.activeElement).not.toBe(text());
    act(() => useShellStore.getState().focusField());
    expect(document.activeElement).toBe(text());
    expect(shell()).toHaveAttribute("data-layout", "home");
  });

  it("New chat on a blank Home starts over without a reload: the skill and the clip go, the typed text stays", async () => {
    await renderHome();
    // A clip staged (it picks Simulate), then Hooks picked instead: the clip is still staged, unseen.
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(pill("Simulate")); // a second tap lets it go
    fireEvent.click(card("Hooks"));
    fireEvent.change(text(), { target: { value: "meal prep" } });
    expect(picked()?.textContent).toBe("Hooks · 1");
    const before = requests("/api/threads/open").length;

    act(() => useShellStore.getState().focusField());

    expect(picked()).toBeNull();
    for (const name of SKILLS) expect(card(name)).toBeInTheDocument();
    expect(text().value).toBe("meal prep");
    expect(document.activeElement).toBe(text());
    expect(screen.queryByTestId("field-video")).toBeNull();
    // The clip was dropped, not hidden: Simulate picked again shows no video.
    fireEvent.click(card("Simulate"));
    expect(screen.queryByTestId("field-video")).toBeNull();
    // No reload: the chat's load did not run again, and nothing was spent.
    await settle();
    expect(requests("/api/threads/open")).toHaveLength(before);
    expect(spending()).toEqual([]);
    expect(shell()).toHaveAttribute("data-layout", "home");
  });

  it("New chat after a refused upload on Home: the error by the field and the clip go too", async () => {
    upload.mockResolvedValue({ error: { message: "storage down" } });
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => expect(field().textContent).toContain("That upload didn't go through."));
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));

    act(() => useShellStore.getState().focusField());

    expect(field().textContent).not.toContain("That upload didn't go through.");
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(picked()).toBeNull();
    expect(document.activeElement).toBe(text());
  });

  it("B6: New chat while a send from Home is still making its chat leaves the clip and the skill of that run", async () => {
    const made = deferred();
    newGate = made.promise;
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => expect(requests("/api/threads/new")).toHaveLength(1));
    expect(shell()).toHaveAttribute("data-layout", "home"); // still Home: the run has not started

    act(() => useShellStore.getState().focusField());

    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(picked()?.textContent).toBe("Simulate · 10");
    await act(async () => {
      made.resolve();
    });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  });

  it("B6: with no send out, New chat on Home still starts over (the guard is only for a send)", async () => {
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    act(() => useShellStore.getState().focusField());
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(picked()).toBeNull();
  });

  it("a Home that mounts after an earlier New chat does not take the focus by itself", async () => {
    act(() => useShellStore.getState().focusField());
    await renderHome();
    expect(document.activeElement).not.toBe(text());
  });
});

describe("Branch A under the new look never draws the old arrival (final fix B6)", () => {
  it("a video run that starts after a thread switch wiped its question shows the thread, not the v8 arrival", async () => {
    holdAnalyzeOpen = true;
    const stored = deferred();
    upload.mockImplementation(() => stored.promise.then(() => ({ error: null })));
    await renderHome();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [clip()] } });
    fireEvent.click(field().querySelector('button[type="submit"]') as HTMLButtonElement);
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));

    // A thread switch while the clip uploads (as the legacy "New chat" path does): it wipes the
    // run's question. Then the upload lands and the read starts.
    act(() => {
      setActiveThreadCookie(NEW_THREAD_SENTINEL);
      useBoardStore.getState().setActiveThreadId(null);
      useBoardStore.getState().switchThread();
    });
    await act(async () => {
      stored.resolve();
    });
    await waitFor(() => expect(requests("/api/analyze")).toHaveLength(1));
    await settle(50);
    expect(screen.queryByTestId("arrival-v8")).toBeNull();
    expect(screen.queryByTestId("arrival-room-line")).toBeNull();
  });
});

describe("Home's other side: a chat with content", () => {
  it("is the thread: docked field with its pills, no greeting", async () => {
    document.cookie = `${ACTIVE_THREAD_COOKIE}=t1; path=/`;
    threadFixture = chatThread();
    renderWithClient(<Composer />);
    await screen.findByText("Start with the mirror shot.");
    expect(shell()).toHaveAttribute("data-layout", "thread");
    expect(screen.getByTestId("next-field-dock").contains(field())).toBe(true);
    for (const name of [...SKILLS, "More"]) expect(inField().getByRole("button", { name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)/ })).toBeNull();
    expect(screen.queryByTestId("home-next")).toBeNull();
    // Glass, and no audience line: More's Audience row is the way to it here.
    expect(field().style.backdropFilter).not.toBe("");
    expect(screen.queryByRole("button", { name: /audience/i })).toBeNull();
  });

  it("on desktop More opens upward over the docked field, and the audience sheet stands on the field", async () => {
    desktop();
    document.cookie = `${ACTIVE_THREAD_COOKIE}=t1; path=/`;
    threadFixture = chatThread();
    renderWithClient(<Composer />);
    await screen.findByText("Start with the mirror shot.");
    fireEvent.click(pill("More"));
    const more = await screen.findByRole("dialog", { name: "More" });
    await settle();
    expect(more).toHaveAttribute("data-side", "top");
    fireEvent.click(within(more).getByRole("button", { name: "Audience: General" }));
    const sheet = await screen.findByRole("dialog", { name: "Audience" });
    await settle();
    expect(sheet).toHaveAttribute("data-side", "top");
    expect(sheet).toHaveAttribute("data-align", "start");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    // What opened it (More's row) has left: the field's text, as before.
    expect(document.activeElement).toBe(text());
  });
});

// ── A chat that is gone never opens a different chat ─────────────────────────
// A saved piece keeps its chat's id after that chat is deleted, and a list row can be stale.
// Opening either points at the deleted chat; the server treats that pointer as stale and answers
// with the creator's newest OTHER chat. The composer must not show that one: it ends on Home.
describe("a chat that is gone never opens a different chat", () => {
  /** The newest other chat, as the server answers a stale pointer: id t1, one exchange. */
  const otherChat = () => chatThread();
  const notices = () => document.querySelector('[aria-label="Notifications"]');
  const GONE = "That chat was deleted.";

  it("a first load whose pointer names a deleted chat: Home, the pointer a new chat, nothing of the other chat, the message once", async () => {
    setActiveThreadCookie("gone-1");
    threadFixture = otherChat();
    useShellStore.setState({ threadBack: "/library", threadTitleHint: { id: "gone-1", title: "Video simulation" } });
    const onRehydratingChange = vi.fn();
    renderWithClient(<Composer onRehydratingChange={onRehydratingChange} />);

    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(await screen.findByRole("heading", { level: 1, name: GREETING })).toBeInTheDocument();
    expect(screen.getByTestId("home-next")).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).toBeNull();
    expect(onRehydratingChange).toHaveBeenLastCalledWith(false);
    // Nothing of the chat the server answered with.
    expect(screen.queryByText("Start with the mirror shot.")).toBeNull();
    expect(screen.queryByText("What should I film first?")).toBeNull();
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(useShellStore.getState().threadBack).toBeNull();
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    // Told once, with the app's toast in its default kind (no error icon: only the close cross).
    await settle(50);
    expect(screen.getAllByText(GONE)).toHaveLength(1);
    expect(notices()!.querySelectorAll("svg")).toHaveLength(1);
    expect(notices()!.innerHTML).not.toContain("text-error");
  });

  it("the server has no chat at all for a deleted pointer (none in its answer): Home the same way", async () => {
    setActiveThreadCookie("gone-1");
    threadFixture = { messages: [] };
    renderWithClient(<Composer />);
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(await screen.findByText(GONE)).toBeInTheDocument();
  });

  it("a switch to a deleted chat (a saved piece, a stale row): Home, nothing of the other chat, the message once", async () => {
    await renderHome();
    expect(screen.queryByText(GONE)).toBeNull();
    threadFixture = otherChat();
    act(() => {
      // As the shell's openThread does it, from Library.
      useShellStore.getState().setThreadBack("/library");
      setActiveThreadCookie("gone-1");
      useBoardStore.getState().setActiveThreadId("gone-1");
      useBoardStore.getState().switchThread();
    });
    await waitFor(() => expect(requests("/api/threads/open")).toHaveLength(2));
    expect(await screen.findByText(GONE)).toBeInTheDocument();
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(screen.getByTestId("home-next")).toBeInTheDocument();
    expect(screen.queryByText("Start with the mirror shot.")).toBeNull();
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(useShellStore.getState().threadBack).toBeNull();
    await settle(50);
    expect(screen.getAllByText(GONE)).toHaveLength(1);
  });

  it("an answer naming the chat asked for is that chat, as today: no message", async () => {
    setActiveThreadCookie("t1");
    threadFixture = otherChat();
    useShellStore.setState({ threadBack: "/library" });
    renderWithClient(<Composer />);
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    expect(shell()).toHaveAttribute("data-layout", "thread");
    expect(getActiveThreadCookie()).toBe("t1");
    expect(useBoardStore.getState().activeThreadId).toBe("t1");
    expect(useShellStore.getState().threadBack).toBe("/library");
    await settle(50);
    expect(screen.queryByText(GONE)).toBeNull();
  });

  it("with no chat asked for (no pointer: a new device), the server's newest chat is opened, as today", async () => {
    clearActiveThreadCookie();
    threadFixture = otherChat();
    renderWithClient(<Composer />);
    expect(await screen.findByText("Start with the mirror shot.")).toBeInTheDocument();
    expect(useBoardStore.getState().activeThreadId).toBe("t1");
    await settle(50);
    expect(screen.queryByText(GONE)).toBeNull();
  });
});
