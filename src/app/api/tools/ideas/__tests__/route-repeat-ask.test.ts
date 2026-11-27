/**
 * route-repeat-ask.test.ts — a retried Ideas run stores the creator's ask once.
 *
 * Retry replays the request exactly. The route stores the ask as a user row before the run, so a
 * run that failed after that, then Retry, used to store it a second time: the thread showed the
 * message twice. Here the real message helpers write to an in-memory database (the I/O boundary);
 * only the model run and the thread lookup are stubbed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { IdeaCardBlock } from "@/lib/tools/blocks";
import { fakeMessagesDb, type FakeMessagesDb } from "@/lib/threads/__tests__/fake-messages-db";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/threads/threads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/threads/threads")>()),
  createOpenThreadLazy: vi.fn(),
}));
vi.mock("@/lib/tools/runners/ideas-runner", () => ({ runIdeasPipeline: vi.fn() }));
vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(() => {
    throw new Error("no model in tests");
  }),
  QWEN_REASONING_MODEL: "qwen-test",
}));
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })) }));

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { runIdeasPipeline } from "@/lib/tools/runners/ideas-runner";
import { POST } from "@/app/api/tools/ideas/route";

const THREAD = "thread-ideas";

function idea(): IdeaCardBlock {
  return {
    type: "idea-card",
    props: {
      title: "Meal prep in 10 minutes",
      angle: "Speed",
      whyItFits: "Busy students",
      mechanism: "Proof",
      seedHook: "You have 10 minutes",
      needsTake: false,
      topic: "Meal prep",
      take: "Fast",
      format: null,
      band: "Mixed",
      fraction: "6/10 stop",
      scrollQuote: "I have 10 minutes",
      model: "sim1-flash",
    },
  };
}

let db: FakeMessagesDb;

beforeEach(() => {
  vi.clearAllMocks();
  db = fakeMessagesDb();
  db.tables.threads!.push({ id: THREAD, user_id: "u-1", title: null });
  (createClient as Mock).mockResolvedValue({
    ...db.client,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
  });
  (createServiceClient as Mock).mockReturnValue(db.client);
  (createOpenThreadLazy as Mock).mockResolvedValue({ id: THREAD, user_id: "u-1", active_audience_id: null });
});

async function post(ask: string) {
  const res = await POST(
    new Request("http://localhost/api/tools/ideas", {
      method: "POST",
      body: JSON.stringify({ ask }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  return res.text();
}

const userTexts = () =>
  db.userRows(THREAD).map((r) => ((r.body as { blocks: { props: { text: string } }[] }).blocks[0]!.props.text));

describe("POST /api/tools/ideas — the creator's ask, stored once", () => {
  it("a failed run, then Retry with the same ask: one user row", async () => {
    (runIdeasPipeline as Mock).mockRejectedValueOnce(new Error("model timed out"));
    expect(await post("meal prep ideas")).toContain("event: error");
    (runIdeasPipeline as Mock).mockResolvedValueOnce({ blocks: [idea()], warnings: [] });
    expect(await post("meal prep ideas")).toContain("event: done");
    expect(userTexts()).toEqual(["meal prep ideas"]);
  });

  it("a different ask after a failed run is a new row", async () => {
    (runIdeasPipeline as Mock).mockRejectedValueOnce(new Error("model timed out"));
    await post("meal prep ideas");
    (runIdeasPipeline as Mock).mockResolvedValueOnce({ blocks: [idea()], warnings: [] });
    await post("gym ideas");
    expect(userTexts()).toEqual(["meal prep ideas", "gym ideas"]);
  });

  it("the same ask after an answer is a new row", async () => {
    (runIdeasPipeline as Mock).mockResolvedValue({ blocks: [idea()], warnings: [] });
    await post("meal prep ideas");
    await post("meal prep ideas");
    expect(userTexts()).toEqual(["meal prep ideas", "meal prep ideas"]);
  });
});
