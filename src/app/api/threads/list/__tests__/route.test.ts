/**
 * GET /api/threads/list — the drawer's names for chats with no stored title.
 *
 * A simulation chat whose only user turn is the dropped file's name used to list with `title: null`
 * (the derive refuses a file name), so the drawer showed it as "New chat", like a blank chat. It now
 * lists under the video's name (the file name without its extension). Shown, NOT read-repaired: the
 * write-once slot stays open for a typed ask (the server titles it at card time anyway). The route is
 * real; the stand-ins are its I/O (auth, the thread list, the message read, the title write).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }),
}));
let rows: Array<{ thread_id: string; role: string; body: unknown }> = [];
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const q = { select: () => q, in: () => q, order: () => q, limit: async () => ({ data: rows, error: null }) };
      return q;
    },
  }),
}));
const titleWrites: Array<[string, string]> = [];
vi.mock("@/lib/threads/threads", () => ({
  listOpenThreads: async () => [
    { id: "sim", title: null, updated_at: "2026-11-26T10:00:00Z", created_at: "2026-11-26T10:00:00Z", pinned_at: null },
    { id: "typed", title: null, updated_at: "2026-11-26T09:00:00Z", created_at: "2026-11-26T09:00:00Z", pinned_at: null },
    { id: "blank", title: null, updated_at: "2026-11-26T08:00:00Z", created_at: "2026-11-26T08:00:00Z", pinned_at: null },
  ],
  setThreadTitleIfEmpty: vi.fn(async (_u: string, tid: string, title: string) => {
    titleWrites.push([tid, title]);
    return true;
  }),
}));

import { GET } from "@/app/api/threads/list/route";

const md = (text: string) => ({ blocks: [{ type: "markdown", props: { text } }] });

beforeEach(() => {
  titleWrites.length = 0;
  rows = [
    { thread_id: "sim", role: "user", body: md("test-pack.mp4") },
    { thread_id: "sim", role: "assistant", body: { blocks: [{ type: "run-header", props: { skill: "test" } }, { type: "video-test-card", props: {} }] } },
    { thread_id: "typed", role: "user", body: md("What should I post this week?") },
  ];
});

describe("GET /api/threads/list — untitled chats", () => {
  it("a simulation chat lists under its video's name, without locking the title", async () => {
    const res = await GET(new Request("http://localhost/api/threads/list"));
    const { threads } = (await res.json()) as { threads: Array<{ id: string; title: string | null }> };
    expect(Object.fromEntries(threads.map((t) => [t.id, t.title]))).toEqual({
      sim: "test-pack",
      typed: "What should I post this week?",
      blank: null,
    });
    // The typed ask is read-repaired as before; the file name is only shown.
    expect(titleWrites).toEqual([["typed", "What should I post this week?"]]);
  });
});
