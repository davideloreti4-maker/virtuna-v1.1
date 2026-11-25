/**
 * answer-parts.ts — a thread turn's raw blocks as the ordered PARTS the new renderer draws
 * (spec 2026-11-21-thread-answers-design.md §3, §4, §4.6).
 *
 * - Each block is validated by the registry first (the same guard `MessageBlocks` runs); a block
 *   that fails becomes a fallback part of type "unknown".
 * - A run of consecutive `hook-card` blocks is ONE hooks part; the same for `idea-card` (ideas)
 *   and `remix-card` (remix). Any other block in between closes the run, including blocks that
 *   draw nothing (a `run-header`, dropped narration), so a turn with two runs shows two cards.
 * - `markdown` is shown only in a turn with no result card (a plain chat answer). In a turn with a
 *   result card it is narration (the live preamble, the closing line, persisted chat-agent prose)
 *   and is dropped. A `corpus-references`, `persona-chat-turn` or `input-request` is not a result
 *   card, so the prose beside it stays.
 * - `input-request` and `outlier-grid` keep their legacy renderers (they are interactive).
 * - Every index is the block's position in the ORIGINAL array, so a part can reach back to it.
 *
 * Pure: no React, no fetch.
 */

import { validateBlock } from "@/lib/tools/block-registry";
import type { CorpusReferencesBlock, HookCardBlock, IdeaCardBlock, ScriptCardBlock, RemixCardBlock } from "@/lib/tools/blocks";
import type { EditBlock, VideoTestCardBlock } from "@/lib/tools/profile-blocks";

export interface Indexed<B> {
  /** Position of the block in the ORIGINAL blocks array. */
  index: number;
  block: B;
}

export type AnswerPart =
  | { kind: "hooks"; items: Indexed<HookCardBlock>[] }
  | { kind: "ideas"; items: Indexed<IdeaCardBlock>[] }
  | { kind: "remix"; items: Indexed<RemixCardBlock>[] }
  | { kind: "script"; item: Indexed<ScriptCardBlock> }
  | { kind: "video"; item: Indexed<VideoTestCardBlock> }
  | { kind: "edit"; item: Indexed<EditBlock> }
  /** Markdown, only in a turn with no result card. */
  | { kind: "text"; index: number; text: string }
  /** `input-request`, `outlier-grid`: the validated block, for its legacy renderer. */
  | { kind: "legacy"; index: number; block: unknown }
  | { kind: "fallback"; index: number; block: { type: string; props: unknown } };

/** The block types that make a turn an answer with a card, so its markdown is narration. */
export const RESULT_TYPES: ReadonlySet<string> = new Set([
  "hook-card",
  "idea-card",
  "script-card",
  "remix-card",
  "video-test-card",
  "edit",
  "composed-card",
  "outlier-grid",
  "account-read",
  "profile-read",
  "multi-audience-read",
  "brought-card",
  "reaction-distribution",
  "prediction-gauge",
  "band",
  "personas",
]);

const LEGACY_TYPES: ReadonlySet<string> = new Set(["input-request", "outlier-grid"]);

const UNKNOWN: { type: string; props: unknown } = { type: "unknown", props: {} };

function typeOf(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const t = (raw as { type?: unknown }).type;
  return typeof t === "string" ? t : null;
}

/**
 * Does the turn hold a result card? Read off the raw `type`, not the validated block: prose in a
 * turn that produced a card is narration whether or not that card still validates.
 */
export function hasResultCard(blocks: readonly unknown[]): boolean {
  return blocks.some((b) => {
    const t = typeOf(b);
    return t !== null && RESULT_TYPES.has(t);
  });
}

export function partsOf(blocks: readonly unknown[]): AnswerPart[] {
  const showText = !hasResultCard(blocks);
  const parts: AnswerPart[] = [];
  // The pack the previous block extended, if any. Every block that does not extend it closes it.
  let run: Extract<AnswerPart, { kind: "hooks" | "ideas" | "remix" }> | null = null;

  blocks.forEach((raw, index) => {
    const v = validateBlock(raw);
    if (!v.ok) {
      run = null;
      parts.push({ kind: "fallback", index, block: UNKNOWN });
      return;
    }
    const block = v.block;
    switch (block.type) {
      case "hook-card": {
        const item = { index, block: block as HookCardBlock };
        if (run?.kind === "hooks") run.items.push(item);
        else parts.push((run = { kind: "hooks", items: [item] }));
        return;
      }
      case "idea-card": {
        const item = { index, block: block as IdeaCardBlock };
        if (run?.kind === "ideas") run.items.push(item);
        else parts.push((run = { kind: "ideas", items: [item] }));
        return;
      }
      case "remix-card": {
        const item = { index, block: block as RemixCardBlock };
        if (run?.kind === "remix") run.items.push(item);
        else parts.push((run = { kind: "remix", items: [item] }));
        return;
      }
    }
    run = null;
    switch (block.type) {
      case "run-header":
        return;
      case "script-card":
        parts.push({ kind: "script", item: { index, block: block as ScriptCardBlock } });
        return;
      case "video-test-card":
        parts.push({ kind: "video", item: { index, block: block as VideoTestCardBlock } });
        return;
      case "edit":
        parts.push({ kind: "edit", item: { index, block: block as EditBlock } });
        return;
      case "markdown":
        if (showText) parts.push({ kind: "text", index, text: (block.props as { text: string }).text });
        return;
      case "corpus-references": {
        // Sources in a row (only hidden narration between) are ONE Sources card, without repeats
        // (Task 7 critic: two stacked Sources cards above one answer).
        const last = parts[parts.length - 1];
        const cur = block as CorpusReferencesBlock;
        if (last?.kind === "fallback" && last.block.type === "corpus-references") {
          const prev = last.block as CorpusReferencesBlock;
          const seen = new Set(prev.props.sources.map(sourceKey));
          const added = cur.props.sources.filter((s) => !seen.has(sourceKey(s)));
          last.block = { ...prev, props: { ...prev.props, sources: [...prev.props.sources, ...added] } };
        } else parts.push({ kind: "fallback", index, block: cur });
        return;
      }
      default:
        if (LEGACY_TYPES.has(block.type)) parts.push({ kind: "legacy", index, block });
        else parts.push({ kind: "fallback", index, block });
    }
  });

  return parts;
}

/** One source, for spotting a repeat across Sources blocks: its video, else its creator and views. */
function sourceKey(s: CorpusReferencesBlock["props"]["sources"][number]): string {
  if (s.videoUrl) return s.videoUrl;
  return `${s.handle.trim().replace(/^@+/, "").toLowerCase()}|${s.views ?? ""}`;
}
