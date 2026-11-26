/**
 * insert-user-turn.test.ts — storing the creator's turn once (Retry replays the last request).
 *
 * Every tool route stores the ask as a user row before its run. A run that fails after that, then
 * Retry (or the same words sent again after Stop), used to store the ask a second time, and the
 * thread showed the message twice. `insertUserTurnUnlessRepeat` stores it only when the thread's
 * last message is not that same user turn.
 *
 * The database is an in-memory stand-in; validation (the block registry) runs for real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { fakeMessagesDb, type FakeMessagesDb } from "./fake-messages-db";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { insertMessage, insertUserTurnUnlessRepeat, loadMessages } from "../messages";

const THREAD = "thread-1";
const ask = (text: string) => ({ type: "markdown", props: { text } });
const personaAsk = (archetype: string, text: string) => ({
  type: "persona-chat-turn",
  props: { archetype, role: "user", text },
});

let db: FakeMessagesDb;

beforeEach(() => {
  vi.clearAllMocks();
  db = fakeMessagesDb();
  (createServiceClient as Mock).mockReturnValue(db.client);
  (createClient as Mock).mockResolvedValue(db.client);
});

describe("insertUserTurnUnlessRepeat", () => {
  it("stores the first turn of a thread, stamped like insertMessage", async () => {
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    const rows = db.userRows(THREAD);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toEqual({ kcGenVersion: "gen.1.0.0", blocks: [ask("3 hooks for meal prep")] });
  });

  it("does not store the same ask again when it is the thread's last message (a Retry)", async () => {
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(1);
    // What the thread reads back: the creator's message once.
    expect(await loadMessages(THREAD)).toHaveLength(1);
  });

  it("stores the same ask again once an answer came after it", async () => {
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    await insertMessage(THREAD, "assistant", [ask("Here are three.")], "gen.1.0.0");
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(2);
  });

  it("stores a different ask", async () => {
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    await insertUserTurnUnlessRepeat(THREAD, ask("4 hooks for meal prep"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(2);
  });

  it("reads only this thread: the same ask last in another thread does not count", async () => {
    await insertUserTurnUnlessRepeat("thread-other", ask("3 hooks for meal prep"), "gen.1.0.0");
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(1);
  });

  it("matches a persona turn on its archetype and text", async () => {
    await insertUserTurnUnlessRepeat(THREAD, personaAsk("skeptic", "Would you watch this?"), "gen.1.0.0");
    await insertUserTurnUnlessRepeat(THREAD, personaAsk("skeptic", "Would you watch this?"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(1);
    await insertUserTurnUnlessRepeat(THREAD, personaAsk("fan", "Would you watch this?"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(2);
  });

  it("a markdown ask and a persona turn with the same words are different turns", async () => {
    await insertUserTurnUnlessRepeat(THREAD, personaAsk("skeptic", "Would you watch this?"), "gen.1.0.0");
    await insertUserTurnUnlessRepeat(THREAD, ask("Would you watch this?"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(2);
  });

  it("matches a row stored without a stamp too (the bare blocks body)", async () => {
    await insertMessage(THREAD, "user", [ask("3 hooks for meal prep")]);
    await insertUserTurnUnlessRepeat(THREAD, ask("3 hooks for meal prep"), "gen.1.0.0");
    expect(db.userRows(THREAD)).toHaveLength(1);
  });

  it("validates the block like insertMessage, before any read", async () => {
    await expect(
      insertUserTurnUnlessRepeat(THREAD, { type: "unknown_future_block", props: {} }, "gen.1.0.0"),
    ).rejects.toThrow(/block failed validation at write boundary/);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("fails when the last message cannot be read", async () => {
    db.failOn("messages", "select");
    await expect(insertUserTurnUnlessRepeat(THREAD, ask("hi"), "gen.1.0.0")).rejects.toThrow(/thread_id=thread-1/);
    expect(db.userRows(THREAD)).toHaveLength(0);
  });

  it("fails the way insertMessage does when the insert fails", async () => {
    db.failOn("messages", "insert");
    await expect(insertUserTurnUnlessRepeat(THREAD, ask("hi"), "gen.1.0.0")).rejects.toThrow(
      /insertMessage: failed for thread_id=thread-1/,
    );
  });
});
