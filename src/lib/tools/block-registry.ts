/**
 * BLOCK_REGISTRY SSOT — server-importable schema half (no client components).
 *
 * Maps blockType → { schema } so the tool-runner and message rehydration share
 * one validation surface (D-14 + THREAD-06).  Renderer components are wired
 * directly in message-blocks.tsx (no separate component-registry module).
 *
 * Consumers:
 *  - tool-runner.ts: assertBlocksInRegistry at structured-output boundary
 *  - message-blocks.tsx: validateBlock per block on rehydration
 */

import { type z } from "zod";
import {
  MarkdownBlockSchema,
  BandBlockSchema,
  PersonasBlockSchema,
  IdeaCardBlockSchema,
  HookCardBlockSchema,
  ScriptCardBlockSchema,
  RemixCardBlockSchema,
  OutlierGridBlockSchema,
  MultiAudienceReadBlockSchema,
  PersonaChatTurnBlockSchema,
  AccountReadBlockSchema,
} from "./blocks";

// ─── Registry ─────────────────────────────────────────────────────────────────

export const BLOCK_REGISTRY = {
  markdown: { schema: MarkdownBlockSchema as z.ZodType },
  band: { schema: BandBlockSchema as z.ZodType },
  personas: { schema: PersonasBlockSchema as z.ZodType },
  "idea-card": { schema: IdeaCardBlockSchema as z.ZodType },
  "hook-card": { schema: HookCardBlockSchema as z.ZodType },
  "script-card": { schema: ScriptCardBlockSchema as z.ZodType },
  "remix-card": { schema: RemixCardBlockSchema as z.ZodType },
  "outlier-grid": { schema: OutlierGridBlockSchema as z.ZodType },
  "multi-audience-read": { schema: MultiAudienceReadBlockSchema as z.ZodType },
  "persona-chat-turn": { schema: PersonaChatTurnBlockSchema as z.ZodType },
  "account-read": { schema: AccountReadBlockSchema as z.ZodType },
} as const;

export type BlockType = keyof typeof BLOCK_REGISTRY;

// ─── validateBlock ────────────────────────────────────────────────────────────
// Never throws — always returns {ok:true, block} | {ok:false}.
// D-14: called at BOTH the tool-runner output boundary and on message rehydration.

export function validateBlock(
  raw: unknown,
): { ok: true; block: { type: BlockType; props: unknown } } | { ok: false } {
  try {
    const type = (raw as Record<string, unknown> | null)?.type;
    if (typeof type !== "string") return { ok: false };
    const entry = (BLOCK_REGISTRY as Record<string, { schema: z.ZodType } | undefined>)[type];
    if (!entry) return { ok: false };
    const parsed = entry.schema.safeParse(raw);
    if (!parsed.success) return { ok: false };
    return {
      ok: true,
      block: parsed.data as { type: BlockType; props: unknown },
    };
  } catch {
    return { ok: false };
  }
}

// ─── assertBlocksInRegistry ──────────────────────────────────────────────────
// Throws if any block's type is outside the allowed BlockType subset.
// Called by the tool-runner after structured-output parse (THREAD-06).

export function assertBlocksInRegistry(
  blocks: Array<{ type: BlockType; props: unknown }>,
  allowed: BlockType[],
): void {
  for (const block of blocks) {
    if (!allowed.includes(block.type)) {
      throw new Error(
        `Block type "${block.type}" is not in the allowed renderer subset [${allowed.join(", ")}]`,
      );
    }
  }
}
