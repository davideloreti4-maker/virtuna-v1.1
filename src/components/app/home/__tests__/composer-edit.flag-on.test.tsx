/** @vitest-environment happy-dom */
/**
 * The door to the editor on Home (plan 2026-11-24-editor-screens-a, Task 16; spec §3 screen 1, E3, E11): the real composer, Home,
 * field, door (`start-edit.ts`) and upload holder. Stand-ins only for what cannot run here: the network (`fetch`, with
 * `/api/edit/open` answering for the account), the router, the storage client, object URLs and the PUT into R2
 * (`XMLHttpRequest`). The setup is `composer-home.flag-on.test.tsx`'s: a blank new chat on a phone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Suspense, startTransition, use, useEffect, useState, type ReactNode } from "react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/lib/flags/ambient-v2", () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock("@/lib/flags/concept-v8", () => ({ CONCEPT_V8_ENABLED: true }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({}), usePathname: () => "/home", useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
const storageUpload = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    storage: { from: () => ({ upload: storageUpload, remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "../composer";
import { forgetUpload, uploadOf } from "@/components/editor/uploads";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL, setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

const TAKE = "22222222-2222-4222-8222-222222222222";
const EDIT = "55555555-5555-4555-8555-555555555555";
/** Whether the editor is open to the account. */
let open = true;
/** What `POST /api/edit/edits` answers: the edit, or a refusal; at once, or when the test says. */
let editAnswer: () => Response | Promise<Response>;
let threadFixture: unknown = { messages: [] };
let asked: { url: string; body: unknown }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const made = () => json({ id: EDIT, threadId: "t-edit" }, 201);

/** The browser's request, stood in: the PUT never ends by itself, and can be stopped. */
class Sending {
  upload = { onprogress: null };
  onload = null;
  onerror = null;
  onabort: (() => void) | null = null;
  status = 0;
  open() {}
  setRequestHeader() {}
  send() {}
  abort() {
    this.onabort?.();
  }
}

beforeEach(() => {
  open = true;
  editAnswer = made;
  threadFixture = { messages: [] };
  asked = [];
  push.mockReset();
  storageUpload.mockReset();
  useShellStore.setState({ fieldFocusSignal: 0, threadBack: null, threadTitleHint: null, libraryScroll: null });
  useBoardStore.setState({ activeThreadId: null });
  document.cookie = `${ACTIVE_THREAD_COOKIE}=${NEW_THREAD_SENTINEL}; path=/`;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("XMLHttpRequest", Sending);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (url.includes("/api/edit/open")) return json({ open });
    if (url === "/api/edit/takes") return json({ take: { id: TAKE }, uploadUrl: "https://r2.test/put" }, 201);
    if (url === "/api/edit/edits") return editAnswer();
    if (url.includes("/api/threads/open")) return json(threadFixture);
    if (url.includes("/api/threads/new")) return json({ threadId: "t-new" });
    if (url.includes("/api/threads/list")) return json({ threads: [] });
    if (url.includes("/api/threads/library")) return json({ chats: [], next: null });
    if (url.includes("/api/audiences")) return json({ audiences: [] });
    if (url.includes("/api/saved")) return json({ items: [] });
    return json({});
  }));
});
afterEach(() => {
  forgetUpload(TAKE);
  cleanup();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderHome() {
  renderWithClient(<Composer />);
  await screen.findByTestId("home-next");
  await waitFor(() => expect(asked.some((one) => one.url.includes("/api/threads/open"))).toBe(true));
}
const shell = () => screen.getByTestId("composer-shell");
const field = () => screen.getByTestId("thread-field");
const text = () => within(field()).getByRole("textbox") as HTMLTextAreaElement;
const picker = () => screen.getByLabelText<HTMLInputElement>("Choose a video file");
const pick = (file: File) => fireEvent.change(picker(), { target: { files: [file] } });
const choice = () => screen.findByRole("group", { name: "What to do with this video" });
const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** A raw take off a phone, past Simulate's 200 MB. */
const take = (megabytes = 300) => {
  const file = new File(["x"], "IMG_0042.MOV", { type: "video/quicktime" });
  Object.defineProperty(file, "size", { value: megabytes * 1024 * 1024 });
  return file;
};
/** A clip both skills take. */
const clip = () => new File(["video-bytes"], "take.mp4", { type: "video/mp4" });
const askedOf = (path: string) => asked.filter((one) => one.url === path);
/** Every request that runs a skill, reads a video or makes a chat by the thread's own path: the door makes none of them. */
const threadSends = () => asked.filter((one) => ["/api/tools/", "/api/analyze", "/api/threads/new", "/api/threads/user-turn"].some((path) => one.url.includes(path)));

describe("Home's door to the editor", () => {
  it("shows six cards to an account the editor is open to; Edit opens the picker inside the tap and waits for a video", async () => {
    await renderHome();
    const edit = await screen.findByRole("button", { name: "Edit" });
    const cards = within(screen.getByRole("list", { name: "Skills" })).getAllByRole("button");
    expect(cards.map((card) => document.getElementById(card.getAttribute("aria-labelledby") ?? "")?.textContent)).toEqual(["Simulate", "Edit", "Hooks", "Script", "Remix", "More"]);
    expect(screen.queryByRole("button", { name: "More skills" })).toBeNull();
    const click = vi.spyOn(picker(), "click");
    fireEvent.click(edit);
    expect(click).toHaveBeenCalledTimes(1);
    // Edit is the picked skill: the field says what it waits for, and its send stays off until there is a video.
    expect(field().querySelector('[data-part="picked-skill"] [hidden]')?.textContent).toBe("Edit");
    expect(text().placeholder).toBe("Add a video to edit");
    expect(within(field()).getByRole("button", { name: "Add a video" })).toHaveTextContent("Add video");
    expect(within(field()).getByRole("button", { name: "Send to edit" })).toBeDisabled();
    await settle(60);
    expect(threadSends()).toEqual([]);
    expect(askedOf("/api/edit/takes")).toEqual([]);
  });

  it("Edit, then a video: staged as an Edit, and its send signs for the take, makes the edit and opens its page", async () => {
    await renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    pick(clip());
    // Simulate could take this clip too, but Edit was picked: the choice says so, and either can still be chosen.
    expect(within(await choice()).getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(within(await choice()).getByRole("button", { name: "Simulate" })).toBeEnabled();
    expect(text().placeholder).toBe("Send to edit this video");
    fireEvent.click(within(field()).getByRole("button", { name: "Send to edit" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    expect(askedOf("/api/edit/takes").map((one) => one.body)).toEqual([{ name: "take.mp4", bytes: 11, type: "video/mp4" }]);
    expect(askedOf("/api/edit/edits").map((one) => one.body)).toEqual([{ take: TAKE }]);
    // The editor's page finds the upload going, under the take's id, with the phone's own copy to play.
    expect(uploadOf(TAKE)).toMatchObject({ status: "sending", localUrl: "blob:test/1" });
    // The edit has its own chat: the thread's send path is not walked, and nothing is uploaded for a Simulate.
    expect(threadSends()).toEqual([]);
    expect(storageUpload).not.toHaveBeenCalled();
    // The router here goes nowhere (a stand-in), so the screen stays: the field has let the video go and is at rest, free
    // for the next thing, and the video cannot be sent a second time.
    await waitFor(() => expect(screen.queryByTestId("field-video")).toBeNull());
    expect(text().placeholder).toBe("Ask anything, or pick a skill");
    expect(within(field()).getByRole("button", { name: "Send message" })).not.toHaveAttribute("aria-busy", "true");
    fireEvent.submit(field());
    await settle(60);
    expect(askedOf("/api/edit/takes")).toHaveLength(1);
    expect(askedOf("/api/edit/edits")).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("stays as it was sent, the send busy, until the editor's page has taken the screen", async () => {
    // A router that navigates as the app's does (Next's `app-router-instance.js`): `push` puts a pending page into the
    // router's state inside a transition and the tree reads it with `use`, so the screen in place stays until the page is in.
    const router: { go(page: Promise<string>): void; arrive(): void } = { go: () => {}, arrive: () => {} };
    function Router({ children }: { children: ReactNode }) {
      const [page, setPage] = useState<string | Promise<string>>("/home");
      useEffect(() => {
        router.go = setPage;
      }, []);
      const at = typeof page === "string" ? page : use(page);
      return at === "/home" ? <>{children}</> : <main data-testid="editor-page">{at}</main>;
    }
    push.mockImplementation((href: string) => startTransition(() => router.go(new Promise<string>((resolve) => { router.arrive = () => resolve(href); }))));
    renderWithClient(<Suspense fallback={null}><Router><Composer /></Router></Suspense>);
    await screen.findByTestId("home-next");
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    pick(clip());
    await choice();
    fireEvent.click(within(field()).getByRole("button", { name: "Send to edit" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    await settle(60);
    // The page is on its way: Home has not gone back to rest under it, and the video cannot be sent again.
    expect(screen.queryByTestId("editor-page")).toBeNull();
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(within(await choice()).getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(within(field()).getByRole("button", { name: "Send to edit" })).toBeDisabled();
    expect(within(field()).getByRole("button", { name: "Send to edit" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("list", { name: "Skills" })).toBeNull();
    fireEvent.submit(field());
    fireEvent.keyDown(text(), { key: "Enter" });
    await settle(60);
    expect(askedOf("/api/edit/takes")).toHaveLength(1);
    expect(askedOf("/api/edit/edits")).toHaveLength(1);
    // The page is in: it takes the screen's place.
    await act(async () => router.arrive());
    expect(await screen.findByTestId("editor-page")).toHaveTextContent(`/edit/${EDIT}`);
    expect(screen.queryByTestId("thread-field")).toBeNull();
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("stages a take Simulate cannot take as an Edit, and sends it to the editor's page", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Edit" });
    pick(take());
    expect(within(await choice()).getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(within(await choice()).getByRole("button", { name: "Simulate" })).toBeDisabled();
    fireEvent.submit(field());
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    expect(askedOf("/api/edit/takes")[0]?.body).toEqual({ name: "IMG_0042.MOV", bytes: 300 * 1024 * 1024, type: "video/quicktime" });
    expect(askedOf("/api/edit/edits")[0]?.body).toEqual({ take: TAKE });
  });

  it("a video attached first is a Simulate, and can be switched to Edit and back before it is sent", async () => {
    await renderHome();
    await screen.findByRole("button", { name: "Edit" });
    pick(clip());
    const simulate = within(await choice()).getByRole("button", { name: "Simulate" });
    const edit = within(await choice()).getByRole("button", { name: "Edit" });
    expect(simulate).toHaveAttribute("aria-pressed", "true");
    expect(simulate.textContent).toBe("Simulate");
    expect(text().placeholder).toBe("Send to simulate this video");
    fireEvent.click(edit);
    expect(edit).toHaveAttribute("aria-pressed", "true");
    expect(simulate).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(text().placeholder).toBe("Send to edit this video");
    fireEvent.click(simulate);
    expect(simulate).toHaveAttribute("aria-pressed", "true");
    expect(within(field()).getByRole("button", { name: "Send to simulate" })).toBeEnabled();
    fireEvent.click(edit);
    fireEvent.click(within(field()).getByRole("button", { name: "Send to edit" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    expect(threadSends()).toEqual([]);
  });

  it("stays on Home when the edit cannot be made: the video still attached, one sentence why, nothing left in the holder", async () => {
    editAnswer = () => json({ error: "something went wrong" }, 500);
    await renderHome();
    await screen.findByRole("button", { name: "Edit" });
    pick(take());
    await choice();
    fireEvent.submit(field());
    expect(await within(field()).findByRole("alert")).toHaveTextContent(/^Something went wrong\.$/);
    expect(push).not.toHaveBeenCalled();
    expect(shell()).toHaveAttribute("data-layout", "home");
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(within(await choice()).getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(uploadOf(TAKE)).toBeNull();
    // The same send again, once the editor answers: it goes through.
    editAnswer = made;
    await waitFor(() => expect(within(field()).getByRole("button", { name: "Send to edit" })).toBeEnabled());
    fireEvent.submit(field());
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    expect(within(field()).queryByRole("alert")).toBeNull();
    expect(askedOf("/api/edit/takes")).toHaveLength(2);
  });

  it("shows no door to an account it is not open to: the four cards, More skills, and Simulate's own limits", async () => {
    open = false;
    await renderHome();
    await waitFor(() => expect(asked.some((one) => one.url.includes("/api/edit/open"))).toBe(true));
    await settle();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByRole("button", { name: "More skills" })).toBeInTheDocument();
    pick(take());
    expect(within(field()).getByRole("alert").textContent).toMatch(/^File too large/);
    expect(screen.queryByTestId("field-video")).toBeNull();
    pick(clip());
    expect(field().querySelector('[data-part="picked-skill"] [hidden]')?.textContent).toBe("Simulate");
    expect(screen.queryByRole("group", { name: "What to do with this video" })).toBeNull();
  });
});

describe("a sentence under the field when the video changes", () => {
  const UPLOAD_FAILED = "That upload didn't go through. Check your connection and try again. No credits used.";
  /** A Simulate send whose upload storage refuses: its sentence stands by the field, the video still staged for another try. */
  async function failASimulateUpload() {
    storageUpload.mockResolvedValue({ error: { message: "storage down" } });
    await renderHome();
    await waitFor(() => expect(asked.some((one) => one.url.includes("/api/edit/open"))).toBe(true));
    await settle();
    pick(clip());
    fireEvent.click(within(field()).getByRole("button", { name: "Send to simulate" }));
    expect(await within(field()).findByRole("alert")).toHaveTextContent(UPLOAD_FAILED);
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "home"));
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
  }

  it("with the editor closed, the video test's own sentence stays when the video is replaced or removed, as before", async () => {
    open = false;
    await failASimulateUpload();
    pick(new File(["other-bytes"], "second.mp4", { type: "video/mp4" }));
    await settle();
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(within(field()).getByRole("alert")).toHaveTextContent(UPLOAD_FAILED);
    fireEvent.click(within(field()).getByRole("button", { name: "Remove video" }));
    await settle();
    expect(screen.queryByTestId("field-video")).toBeNull();
    expect(within(field()).getByRole("alert")).toHaveTextContent(UPLOAD_FAILED);
  });

  it("with the editor open, the video test's own sentence stays too: only the door's own goes with its video", async () => {
    await failASimulateUpload();
    pick(new File(["other-bytes"], "second.mp4", { type: "video/mp4" }));
    await settle();
    expect(within(field()).getByRole("alert")).toHaveTextContent(UPLOAD_FAILED);
  });

  it("with the editor open, the door's sentence about a video goes when another is picked", async () => {
    editAnswer = () => json({ error: "something went wrong" }, 500);
    await renderHome();
    await screen.findByRole("button", { name: "Edit" });
    pick(take());
    await choice();
    fireEvent.submit(field());
    expect(await within(field()).findByRole("alert")).toHaveTextContent(/^Something went wrong\.$/);
    pick(clip());
    await waitFor(() => expect(within(field()).queryByRole("alert")).toBeNull());
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
  });
});

describe("the editor in a chat's skill menu", () => {
  /** Opens the field's skill menu and returns it. */
  const skillMenu = async () => {
    fireEvent.click(within(field()).getByRole("button", { name: "Skills" }));
    return screen.findByRole("dialog", { name: "Skills" });
  };
  /** Picks a skill from the menu; waits for its row (Edit's appears once the editor is known open). */
  const pickSkill = async (name: string) => {
    const menu = await skillMenu();
    fireEvent.click(await within(menu).findByRole("button", { name }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Skills" })).toBeNull());
  };
  /** The staged video's choice, Simulate or Edit, by name. */
  const chosen = async (name: "Simulate" | "Edit") => within(await choice()).getByRole("button", { name });
  const editKnown = async () => {
    await waitFor(() => expect(asked.some((one) => one.url.includes("/api/edit/open"))).toBe(true));
    await settle();
  };
  const chat = () => {
    const at = "2026-11-21T00:00:00.000Z";
    return {
      threadId: "t1",
      messages: [
        { id: "u1", thread_id: "t1", role: "user", blocks: [{ type: "markdown", props: { text: "What should I film first?" } }], created_at: at },
        { id: "m1", thread_id: "t1", role: "assistant", blocks: [{ type: "markdown", props: { text: "Start with the mirror shot." } }], created_at: at },
      ],
      simSeals: {},
    };
  };

  it("is listed beside Simulate where the editor is open, and a video sent with it leaves the chat for the editor", async () => {
    setActiveThreadCookie("t1");
    threadFixture = chat();
    renderWithClient(<Composer />);
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await pickSkill("Edit");
    expect(within(field().querySelector('[data-part="picked-skill"]') as HTMLElement).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    pick(clip());
    expect(await screen.findByTestId("field-video")).toBeInTheDocument();
    expect(await chosen("Edit")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(field()).getByRole("button", { name: "Send to edit" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    expect(threadSends()).toEqual([]);
  });

  it("a take only the editor takes, switched to Simulate, is held to Simulate's limit at the send; another video takes the sentence away", async () => {
    setActiveThreadCookie("t1");
    threadFixture = chat();
    renderWithClient(<Composer />);
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await editKnown();
    pick(take());
    expect(await screen.findByTestId("field-video")).toBeInTheDocument();
    expect(await chosen("Edit")).toHaveAttribute("aria-pressed", "true");
    // The choice cannot take Simulate for this file; the menu still can, and the send holds it.
    expect(await chosen("Simulate")).toBeDisabled();
    await pickSkill("Simulate");
    expect(await chosen("Simulate")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(field()).getByRole("button", { name: "Send to simulate" }));
    expect(await within(field()).findByRole("alert")).toHaveTextContent("File too large (300.0 MB). Maximum size is 200MB.");
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    await settle(60);
    expect(threadSends()).toEqual([]);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(askedOf("/api/edit/takes")).toEqual([]);
    pick(clip());
    expect(within(field()).queryByRole("alert")).toBeNull();
  });

  it("shows no running card of an earlier Simulate while a video goes to the editor", async () => {
    // The chat's last run was a video test: its card is the last thing in it.
    setActiveThreadCookie("t1");
    const card = {
      type: "video-test-card",
      props: {
        craftScore: 77, drivers: [{ name: "Hook", score: 82, band: "strong" }], filmstrip: [], dropLabel: null, durationLabel: "0:29",
        working: ["The cold open lands"], notWorking: [], fixes: [], audienceName: "Your audience", analysisId: "an-1", model: "sim1-max", tier: "Validated",
      },
    };
    threadFixture = { threadId: "t1", messages: [...chat().messages, { id: "m2", thread_id: "t1", role: "assistant", blocks: [card], created_at: "2026-11-21T00:00:00.000Z" }], simSeals: {} };
    let answer!: (response: Response) => void;
    editAnswer = () => new Promise<Response>((resolve) => { answer = resolve; });
    renderWithClient(<Composer />);
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await pickSkill("Edit");
    pick(clip());
    await screen.findByTestId("field-video");
    fireEvent.click(within(field()).getByRole("button", { name: "Send to edit" }));
    await waitFor(() => expect(askedOf("/api/edit/edits")).toHaveLength(1));
    // The edit is being made: the send is busy, and the chat shows nothing of a video test running.
    expect(within(field()).getByRole("button", { name: "Send to edit" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("uploading")).toBeNull();
    fireEvent.submit(field());
    await settle();
    expect(askedOf("/api/edit/takes")).toHaveLength(1);
    await act(async () => answer(made()));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`));
    expect(screen.queryByText("uploading")).toBeNull();
  });

  it("is not there for an account the editor is not open to", async () => {
    open = false;
    setActiveThreadCookie("t1");
    threadFixture = chat();
    renderWithClient(<Composer />);
    await waitFor(() => expect(shell()).toHaveAttribute("data-layout", "thread"));
    await editKnown();
    const menu = await skillMenu();
    expect(within(menu).getByRole("button", { name: "Simulate" })).toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
