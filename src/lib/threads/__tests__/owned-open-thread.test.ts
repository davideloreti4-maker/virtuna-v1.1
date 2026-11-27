/**
 * owned-open-thread.test.ts — `getOwnedOpenThread`, the check that pins a Test run (and its card) to
 * a chat named by the client. The function is real; its one stand-in is the service client (I/O),
 * a fake that records every filter it is given.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const filters: Array<[string, string, unknown]> = [];
let answer: Record<string, unknown> | null = null;
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filters.push(["eq", `${table}.${col}`, val]);
          return q;
        },
        is: (col: string, val: unknown) => {
          filters.push(["is", `${table}.${col}`, val]);
          return q;
        },
        maybeSingle: async () => ({ data: answer, error: null }),
      };
      return q;
    },
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { getOwnedOpenThread } from "@/lib/threads/threads";

beforeEach(() => {
  filters.length = 0;
  answer = null;
});

describe("getOwnedOpenThread", () => {
  it("asks for that id, owned by the caller, an open chat, not a reading's chat", async () => {
    answer = { id: "chat-A", user_id: "u1" };
    expect(await getOwnedOpenThread("u1", "chat-A")).toEqual({ id: "chat-A", user_id: "u1" });
    expect(filters).toEqual([
      ["eq", "threads.id", "chat-A"],
      ["eq", "threads.user_id", "u1"],
      ["eq", "threads.type", "open"],
      ["is", "threads.reading_id", null],
    ]);
  });

  it("nothing found (foreign, archived, gone): null", async () => {
    answer = null;
    expect(await getOwnedOpenThread("u1", "someone-elses")).toBeNull();
  });

  it("no id, or the blank-chat sentinel: null, and the database is not asked", async () => {
    expect(await getOwnedOpenThread("u1", "")).toBeNull();
    expect(await getOwnedOpenThread("u1", "__new__")).toBeNull();
    expect(filters).toEqual([]);
  });
});
