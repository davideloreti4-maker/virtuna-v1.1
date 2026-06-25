/**
 * messages.test.ts — round-trip persistence test for message helpers.
 *
 * Tests:
 *   1. insertMessage + loadMessages round-trip: valid blocks survive unchanged.
 *   2. Mixed valid/invalid blocks: valid blocks rehydrate, invalid blocks become
 *      UnsupportedBlock sentinels — no data loss, no crash (D-14 / Pitfall #4).
 *   3. insertMessage rejects blocks that fail validateBlock at write boundary.
 *
 * Mocks createServiceClient and createClient (supabase) so no live DB is needed.
 * The block-registry (validateBlock) runs REAL — the test validates the actual
 * registry logic, not a mock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mock Supabase clients ────────────────────────────────────────────────────

// We mock at the module level so the helpers pick up the fakes.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { insertMessage, loadMessages } from "../messages";
import type { MessageRow } from "../messages";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Tests ────────────────────────────────────────────────────────────────────

const THREAD_ID = "00000000-0000-0000-0000-000000000001";

const VALID_MARKDOWN_BLOCK = { type: "markdown", props: { text: "Hello world" } };
const VALID_BAND_BLOCK = {
  type: "band",
  props: { band: "Strong", fraction: "7/10 stop", model: "sim1-flash" },
};
// A block with a type outside the registry — should fail validation.
const INVALID_BLOCK = { type: "unknown_future_block", props: { data: 42 } };

describe("insertMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a message with valid blocks and returns the row", async () => {
    const blocks = [VALID_MARKDOWN_BLOCK, VALID_BAND_BLOCK];
    const fakeRow: MessageRow = {
      id: "msg-1",
      thread_id: THREAD_ID,
      role: "assistant",
      body: blocks,
      created_at: "2026-06-17T00:00:00Z",
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: fakeRow, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    (createServiceClient as Mock).mockReturnValue({ from: mockFrom });

    const result = await insertMessage(THREAD_ID, "assistant", blocks);

    expect(result.id).toBe("msg-1");
    expect(result.role).toBe("assistant");
    expect(mockFrom).toHaveBeenCalledWith("messages");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ thread_id: THREAD_ID, role: "assistant", body: blocks }),
    );
  });

  it("throws when a block fails validateBlock at write boundary (D-14)", async () => {
    // INVALID_BLOCK has an unknown type — registry rejects it.
    await expect(
      insertMessage(THREAD_ID, "user", [INVALID_BLOCK]),
    ).rejects.toThrow(/block failed validation at write boundary/);
  });

  it("does NOT call supabase when block validation fails", async () => {
    (createServiceClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnThis(),
    });

    await expect(
      insertMessage(THREAD_ID, "assistant", [INVALID_BLOCK]),
    ).rejects.toThrow();

    // from() should never be called — validateBlock throws first
    expect((createServiceClient as Mock)().from).not.toHaveBeenCalled();
  });
});

describe("loadMessages — rehydration with re-validation (D-14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid blocks unchanged on round-trip", async () => {
    const blocks = [VALID_MARKDOWN_BLOCK, VALID_BAND_BLOCK];
    const fakeRows: MessageRow[] = [
      {
        id: "msg-1",
        thread_id: THREAD_ID,
        role: "assistant",
        body: blocks,
        created_at: "2026-06-17T00:00:00Z",
      },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: fakeRows, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    (createClient as Mock).mockResolvedValue({ from: mockFrom });

    const messages = await loadMessages(THREAD_ID);

    expect(messages).toHaveLength(1);
    expect(messages[0]!.blocks).toHaveLength(2);

    // Both valid blocks come back intact.
    expect(messages[0]!.blocks[0]).toMatchObject({ type: "markdown", props: { text: "Hello world" } });
    expect(messages[0]!.blocks[1]).toMatchObject({ type: "band", props: { band: "Strong" } });
  });

  it("maps invalid blocks to UnsupportedBlock sentinel — no data loss, no crash (Pitfall #4)", async () => {
    const mixedBlocks = [VALID_MARKDOWN_BLOCK, INVALID_BLOCK, VALID_BAND_BLOCK];
    const fakeRows: MessageRow[] = [
      {
        id: "msg-2",
        thread_id: THREAD_ID,
        role: "assistant",
        body: mixedBlocks,
        created_at: "2026-06-17T00:01:00Z",
      },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: fakeRows, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    (createClient as Mock).mockResolvedValue({ from: mockFrom });

    const messages = await loadMessages(THREAD_ID);

    expect(messages).toHaveLength(1);
    // All three blocks present — no data loss.
    expect(messages[0]!.blocks).toHaveLength(3);

    // Block 0: valid markdown — passes through intact.
    expect(messages[0]!.blocks[0]).toMatchObject({ type: "markdown" });

    // Block 1: invalid type — becomes UnsupportedBlock sentinel.
    expect(messages[0]!.blocks[1]).toMatchObject({
      type: "__unsupported__",
      props: { raw: INVALID_BLOCK },
    });

    // Block 2: valid band — passes through intact.
    expect(messages[0]!.blocks[2]).toMatchObject({ type: "band" });
  });

  it("returns empty array for a thread with no messages", async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    (createClient as Mock).mockResolvedValue({ from: mockFrom });

    const messages = await loadMessages(THREAD_ID);

    expect(messages).toHaveLength(0);
  });

  it("throws when supabase returns an error", async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    (createClient as Mock).mockResolvedValue({ from: mockFrom });

    await expect(loadMessages(THREAD_ID)).rejects.toThrow(/DB error/);
  });
});

describe("loadMessages — validateBlock called on EVERY block of EVERY message", () => {
  it("calls validateBlock implicitly via registry for each block", async () => {
    // Three messages, each with one block — verifies the re-validation loop
    // iterates correctly across multiple messages.
    const fakeRows: MessageRow[] = [
      { id: "m1", thread_id: THREAD_ID, role: "user", body: [VALID_MARKDOWN_BLOCK], created_at: "T1" },
      { id: "m2", thread_id: THREAD_ID, role: "assistant", body: [INVALID_BLOCK], created_at: "T2" },
      { id: "m3", thread_id: THREAD_ID, role: "tool", body: [VALID_BAND_BLOCK, INVALID_BLOCK], created_at: "T3" },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: fakeRows, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    (createClient as Mock).mockResolvedValue({ from: mockFrom });

    const messages = await loadMessages(THREAD_ID);

    expect(messages).toHaveLength(3);
    // m1: valid markdown
    expect(messages[0]!.blocks[0]).toMatchObject({ type: "markdown" });
    // m2: unsupported
    expect(messages[1]!.blocks[0]).toMatchObject({ type: "__unsupported__" });
    // m3: valid band + unsupported
    expect(messages[2]!.blocks[0]).toMatchObject({ type: "band" });
    expect(messages[2]!.blocks[1]).toMatchObject({ type: "__unsupported__" });
  });
});
