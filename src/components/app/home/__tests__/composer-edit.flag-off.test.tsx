/** @vitest-environment happy-dom */
/**
 * Flag off, the editor has no door (plan 2026-11-24-editor-screens-a, Task 16): the legacy composer asks nothing about it, lists
 * no Edit in its `/` menu, and `/edit` arms nothing, so its send path is never walked. The skill's row exists in the registry
 * for the new look's card and pill alone (`enabled: false`).
 *
 * The real composer; stand-ins only for the network (`fetch`), the router and the storage client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithClient } from "@/test/render-with-client";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({}), usePathname: () => "/home", useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  }),
}));

import { Composer } from "../composer";
import { SKILLS } from "../composer-controls";
import { ACTIVE_THREAD_COOKIE } from "@/lib/threads/active-thread-cookie";

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const asked = () => vi.mocked(global.fetch).mock.calls.map(([input]) => String(input));
const settle = (ms = 40) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  cleanup();
  push.mockReset();
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    // Were it asked, the editor would be open: nothing below may show for it all the same.
    if (url.includes("/api/edit/open")) return json({ open: true });
    if (url.includes("/api/threads/open")) return json({ messages: [] });
    if (url.includes("/api/threads/list")) return json({ threads: [] });
    if (url.includes("/api/audiences")) return json({ audiences: [] });
    return json({});
  }) as typeof fetch;
});
afterEach(() => {
  cleanup();
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0`;
  vi.restoreAllMocks();
});

describe("flag off: no door to the editor", () => {
  it("asks nothing about the editor and shows no Edit, on the page or in the `/` menu", async () => {
    renderWithClient(<Composer />);
    await settle();
    expect(asked().filter((url) => url.includes("/api/edit/"))).toEqual([]);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "/" } });
    const menu = screen.getByRole("menu", { name: /skills/i });
    expect(screen.getByRole("menuitemradio", { name: /hooks/i })).toBeInTheDocument();
    expect(menu.textContent).not.toMatch(/Edit|raw take/);
  });

  it("`/edit` arms nothing: Enter leaves the placeholder and the send as they were, and no page opens", async () => {
    renderWithClient(<Composer />);
    await settle();
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    const before = field.placeholder;
    fireEvent.change(field, { target: { value: "/edit" } });
    expect(screen.queryByRole("menuitemradio")).toBeNull();
    fireEvent.keyDown(field, { key: "Enter" });
    await settle();
    expect(field.placeholder).toBe(before);
    expect(asked().filter((url) => url.includes("/api/edit/"))).toEqual([]);
    expect(push).not.toHaveBeenCalled();
  });

  it("the registry's row is off, so every list that reads it leaves Edit out", () => {
    expect(SKILLS.find((skill) => skill.id === "edit")).toMatchObject({ label: "Edit", enabled: false });
  });
});
