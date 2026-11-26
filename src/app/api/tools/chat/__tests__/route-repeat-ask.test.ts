/**
 * route-repeat-ask.test.ts — a retried chat turn stores the creator's ask once.
 *
 * Retry replays the request exactly. The route stores the ask as a user row before the run, so a
 * run that failed after that, then Retry, used to store it a second time: after the fold or a
 * reload the thread showed the message twice. Here the real message helpers write to an in-memory
 * database (the I/O boundary); only the model run and the thread lookup are stubbed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { fakeMessagesDb, type FakeMessagesDb } from "@/lib/threads/__tests__/fake-messages-db";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/threads/threads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/threads/threads")>()),
  createOpenThreadLazy: vi.fn(),
  getOpenThread: vi.fn(),
}));
vi.mock("@/lib/tools/runners/chat-runner", () => ({ runChatPipeline: vi.fn(), isColdStart: vi.fn(() => false) }));
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })) }));

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { runChatPipeline } from "@/lib/tools/runners/chat-runner";
import { POST } from "@/app/api/tools/chat/route";

const THREAD = "thread-chat";
const answers = (text: string) => async (_input: unknown, onToken: (delta: string) => void) => {
  onToken(text);
  return { fullContent: text, coldStart: false };
};

let db: FakeMessagesDb;

beforeEach(() => {
  vi.clearAllMocks();
  // The plain chat path (no dispatch): the model run is `runChatPipeline`, stubbed above.
  process.env.CHAT_AGENT_DISPATCH = "false";
  db = fakeMessagesDb();
  db.tables.threads!.push({ id: THREAD, user_id: "u-1", title: null });
  (createClient as Mock).mockResolvedValue({
    ...db.client,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
  });
  (createServiceClient as Mock).mockReturnValue(db.client);
  (createOpenThreadLazy as Mock).mockResolvedValue({ id: THREAD, user_id: "u-1", active_audience_id: null });
});

afterEach(() => {
  delete process.env.CHAT_AGENT_DISPATCH;
});

async function post(ask: string) {
  const res = await POST(
    new Request("http://localhost/api/tools/chat", {
      method: "POST",
      body: JSON.stringify({ ask, platform: "tiktok" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  return res.text();
}

const userTexts = () =>
  db.userRows(THREAD).map((r) => ((r.body as { blocks: { props: { text: string } }[] }).blocks[0]!.props.text));

describe("POST /api/tools/chat — the creator's ask, stored once", () => {
  it("a failed run, then Retry with the same ask: one user row", async () => {
    (runChatPipeline as Mock).mockRejectedValueOnce(new Error("model timed out"));
    expect(await post("What should I post?")).toContain("event: error");
    (runChatPipeline as Mock).mockImplementationOnce(answers("Post the meal prep one."));
    expect(await post("What should I post?")).toContain("event: done");
    expect(userTexts()).toEqual(["What should I post?"]);
  });

  it("a different ask after a failed run is a new row", async () => {
    (runChatPipeline as Mock).mockRejectedValueOnce(new Error("model timed out"));
    await post("What should I post?");
    (runChatPipeline as Mock).mockImplementationOnce(answers("Post the meal prep one."));
    await post("What should I post today?");
    expect(userTexts()).toEqual(["What should I post?", "What should I post today?"]);
  });

  it("the same ask after an answer is a new row", async () => {
    (runChatPipeline as Mock).mockImplementation(answers("Post the meal prep one."));
    await post("What should I post?");
    await post("What should I post?");
    expect(userTexts()).toEqual(["What should I post?", "What should I post?"]);
  });
});
