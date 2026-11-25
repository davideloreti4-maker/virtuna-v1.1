/** @vitest-environment happy-dom */
/**
 * Copy and Save in the sheet (spec §3): new-look buttons over today's hooks. Real: the hooks, TanStack
 * Query, the provenance contexts. Stood in for: the clipboard and the network (`fetch`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";
import { BlockOriginContext, ThreadIdContext } from "@/lib/save-provenance-context";
import { CopyButton, SaveButton, useCopyText, useSaveToggle } from "../sheet-actions";
import { MEAL_PREP_HOOKS } from "./fixtures/answers";

const HOOK = MEAL_PREP_HOOKS[0]!.props.hookLine;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

function CopyHarness() {
  const c = useCopyText(HOOK);
  return <CopyButton copied={c.copied} onCopy={c.copy} />;
}

function SaveHarness() {
  const s = useSaveToggle({ itemType: "hook", title: HOOK, snapshot: { hookLine: HOOK } });
  return <SaveButton saved={s.saved} onToggle={s.toggle} />;
}

describe("Copy", () => {
  it("copies the text and says 'Copied' for a moment", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyHarness />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(writeText).toHaveBeenCalledWith(HOOK);
    expect(screen.getByText("Copied")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Copied")).toBeNull(), { timeout: 2500 });
  });

  it("no clipboard (an insecure page): nothing happens, nothing throws", () => {
    render(<CopyHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.queryByText("Copied")).toBeNull();
  });
});

describe("Save", () => {
  /**
   * `/api/saved` as it behaves: a POST stores the row and a DELETE removes it, so the refetch after
   * either reads them. `holdAfterPost`: list reads after a POST wait for it (a slow refetch).
   */
  function stubSaved(initial: { id: string; [field: string]: unknown }[], holdAfterPost?: Promise<void>) {
    const calls: { url: string; method: string; body: unknown }[] = [];
    let items = [...initial];
    let posted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const sent = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url: String(url), method, body: sent });
        if (method === "GET" && posted && holdAfterPost) await holdAfterPost;
        let body: unknown = { items };
        if (method === "POST") {
          const item = { id: "row-new", user_id: "u1", project_id: null, created_at: "2026-11-23T00:00:00Z", ...sent };
          items = [item, ...items];
          posted = true;
          body = { item };
        } else if (method === "DELETE") {
          const id = new URL(String(url), "http://localhost").searchParams.get("id");
          items = items.filter((i) => i.id !== id);
          body = { id };
        }
        return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    return calls;
  }

  function renderSave(origin: BlockOrigin | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ThreadIdContext.Provider value="t1">
          <BlockOriginContext.Provider value={origin}>
            <SaveHarness />
          </BlockOriginContext.Provider>
        </ThreadIdContext.Provider>
      </QueryClientProvider>,
    );
  }

  it("not saved: saves with the block's own ref and the thread, then reads Saved", async () => {
    const calls = stubSaved([]);
    renderSave({ messageId: "m1", index: 2 });
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    await waitFor(() => expect(calls.find((c) => c.method === "POST")).toBeTruthy());
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({
      item_type: "hook",
      ref_id: "m1:2",
      thread_id: "t1",
      title: HOOK,
      snapshot: { hookLine: HOOK },
    });
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("already on the shelf: pressed; a tap removes that row", async () => {
    const calls = stubSaved([
      { id: "row-1", user_id: "u1", item_type: "hook", ref_id: "m1:2", thread_id: "t1", project_id: null, title: HOOK, snapshot: {}, created_at: "2026-11-22T00:00:00Z" },
    ]);
    renderSave({ messageId: "m1", index: 2 });
    const button = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(button);
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/saved?id=row-1")).toBe(true));
  });

  it("saved a moment ago, its row not back yet: a second tap removes nothing", async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const calls = stubSaved([], held);
    renderSave({ messageId: "m1", index: 2 });
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    // The POST is back and the list's refetch is out (held): the row shown is still the optimistic one.
    await waitFor(() => expect(calls.filter((c) => c.method === "GET").length).toBeGreaterThanOrEqual(2));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("a block not stored yet (no ref): saves once with a null ref; a second tap writes nothing", async () => {
    const calls = stubSaved([]);
    renderSave(null);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(button);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ ref_id: null });
  });
});
