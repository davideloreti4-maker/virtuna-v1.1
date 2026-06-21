/**
 * messages.ts — message persistence helpers
 *
 * Provides:
 *   insertMessage(threadId, role, blocks) — validate each block via validateBlock
 *     BEFORE writing; insert one row with body = blocks (D-13 / D-14)
 *   loadMessages(threadId) — select ordered by created_at; run EACH block of
 *     EACH message through validateBlock on rehydration (D-14 / Pitfall #4);
 *     blocks failing validation are mapped to an UnsupportedBlock marker so
 *     the renderer can show a placeholder — the message is NEVER dropped.
 *
 * Design notes:
 * - Writes use createServiceClient (service role bypasses RLS; thread ownership
 *   must be verified by the caller before invoking insertMessage).
 * - Reads use the RLS-scoped session client — DB enforces ownership.
 * - validateBlock is called TWICE per block: on write boundary (insertMessage)
 *   and on rehydration (loadMessages). This is the structural enforcement of
 *   D-14 / "no model-generated UI": blocks outside the registry cannot persist.
 * - user_id is NEVER read from a request body in these helpers.
 *
 * Row types derive from the regenerated database.types.ts (Task 3).
 * messages.body is `Json` in the generated type (jsonb column); role is `string`.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { validateBlock } from "@/lib/tools/block-registry";
import type { BlockType } from "@/lib/tools/block-registry";
import type { Database, Json } from "@/types/database.types";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A valid block already resolved against its schema. */
export interface ValidBlock {
  type: BlockType;
  props: unknown;
}

/** Sentinel for a block that failed validateBlock on rehydration. */
export interface UnsupportedBlock {
  type: "__unsupported__";
  props: { raw: unknown };
}

/** A single hydrated block — either valid or an unsupported placeholder. */
export type HydratedBlock = ValidBlock | UnsupportedBlock;

/** Raw message row — derived from the regenerated database.types.ts. */
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

/** A message with its blocks already re-validated on rehydration. */
export interface HydratedMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "tool";
  blocks: HydratedBlock[];
  created_at: string;
}

// ─── insertMessage ────────────────────────────────────────────────────────────
/**
 * Validate each block against the BLOCK_REGISTRY schema, then insert one
 * message row with body = blocks array.
 *
 * Throws if any block fails validation — the caller must only pass
 * registry-valid blocks (tool-runner boundary enforces this via
 * assertBlocksInRegistry; insertMessage is the belt-and-suspenders check).
 *
 * Uses createServiceClient: the caller is responsible for verifying thread
 * ownership before invoking this (e.g. verify readingId belongs to the
 * authenticated user before calling createGroundedThreadLazy).
 */
export async function insertMessage(
  threadId: string,
  role: "user" | "assistant" | "tool",
  blocks: unknown[],
  kcGenVersion?: string,
): Promise<MessageRow> {
  // Validate all blocks at the write boundary (D-14).
  for (const raw of blocks) {
    const result = validateBlock(raw);
    if (!result.ok) {
      throw new Error(
        `insertMessage: block failed validation at write boundary: ${JSON.stringify(raw)}`,
      );
    }
  }

  const supabase = createServiceClient();

  // Body is canonically the blocks array. When a KC provenance stamp is supplied
  // (T-03-12), store the wrapper { kcGenVersion, blocks } instead — loadMessages
  // unwraps both shapes. The blocks array is the validated payload either way; the
  // stamp never participates in block validation (it is message-level metadata).
  const body: Json = kcGenVersion
    ? ({ kcGenVersion, blocks } as unknown as Json)
    : (blocks as Json[]);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      thread_id: threadId,
      role,
      body,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `insertMessage: failed for thread_id=${threadId}: ${error?.message ?? "no data"}`,
    );
  }

  return data;
}

// ─── unwrapBody ────────────────────────────────────────────────────────────────
/**
 * Normalise a persisted message body to its blocks array. Supports both the bare
 * `Block[]` shape and the `{ kcGenVersion, blocks: Block[] }` provenance wrapper
 * (T-03-12). Anything else → [] (no data loss path: caller maps to placeholders).
 */
function unwrapBody(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { blocks?: unknown }).blocks)) {
    return (body as { blocks: unknown[] }).blocks;
  }
  return [];
}

// ─── loadMessages ────────────────────────────────────────────────────────────
/**
 * Load all messages for a thread, ordered by created_at (oldest first).
 * Re-validates each block via validateBlock on rehydration (D-14 / Pitfall #4).
 *
 * Blocks that fail validation are mapped to an UnsupportedBlock sentinel
 * ({ type: "__unsupported__", props: { raw } }) so the renderer can show a
 * placeholder. The message is NEVER dropped — partial rehydration is correct
 * behaviour.
 *
 * Uses the RLS-scoped session client — the DB enforces ownership via the
 * messages_select_own policy (EXISTS subquery on threads).
 */
export async function loadMessages(threadId: string): Promise<HydratedMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`loadMessages: failed for thread_id=${threadId}: ${error.message}`);
  }

  const rows = data ?? [];

  return rows.map((row) => ({
    id: row.id,
    thread_id: row.thread_id,
    // role is `string` in the generated type; narrow to the known union.
    role: row.role as "user" | "assistant" | "tool",
    created_at: row.created_at,
    // Body is either the raw blocks array or a { kcGenVersion, blocks } provenance
    // wrapper (T-03-12). Unwrap both shapes back to the blocks array for rehydration.
    blocks: unwrapBody(row.body).map((raw): HydratedBlock => {
      // Re-validate each block on rehydration (D-14 + Pitfall #4).
      const result = validateBlock(raw);
      if (result.ok) {
        return result.block as ValidBlock;
      }
      // Failed validation → unsupported placeholder (no data loss, no crash).
      return { type: "__unsupported__", props: { raw } };
    }),
  }));
}
