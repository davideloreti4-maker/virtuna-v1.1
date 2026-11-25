/**
 * chat-summary.ts — what one chat holds and how it did, for its Library row (plan 2026-11-23-library):
 * "3 hooks", simulated or not, and the number of the piece simulated last.
 *
 * Read from what is stored: the chat's message bodies and its `sim_seals`. Nothing new is derived:
 *
 * - The pieces are the cards the thread draws, read through the thread's own `partsOf` (the registry
 *   check included, so a card the thread cannot draw is not counted).
 * - Each piece looks up its seal by the text the thread fires and looks up (`sealKey`): a hook's
 *   line, an idea's title, a script's opening line, a remix's adapted hook, brought text's stimulus,
 *   a video's analysis id. The script rule is repeated from `openerOf` (`thread-turn-next.tsx`, a
 *   client component); `chat-summary-keys.test.tsx` renders the real thread turn to hold the two equal.
 * - A text's number is `stopNumberOf(seal)` ("would stop to watch"), only for a seal the text result
 *   page serves (no video depth, a number), as `GET /api/threads/[id]/seals/[key]` decides.
 * - A video's number is `headlineOf(audienceOf(...))` ("watch to the end") over the heatmap the seal
 *   copied from the run's row: the heatmap is all the number reads. Never `pct`, `stopPct` or the
 *   fold population's stop rate. No audience the result page can draw → no number.
 *
 * Pure: no React, no I/O. Never throws on odd stored data: what cannot be read contributes nothing.
 */

import { audienceOf } from "@/lib/result/curve";
import { headlineOf } from "@/lib/result/headline";
import { partsOf } from "@/lib/thread-next/answer-parts";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { sealKey, type SimSeal, type SimSealMap } from "@/lib/threads/sim-seals";
import type { BroughtCardBlock, ScriptCardBlock } from "@/lib/tools/blocks";

export type PieceKind = "video" | "script" | "remix" | "hooks" | "ideas" | "text" | "chat";
export type Stage = "simulated" | "draft" | "chat";

export interface SimSummary {
  number: number; // 0..100, whole
  measure: "stop" | "end"; // "would stop to watch" | "watch to the end"
  at: string; // ISO time of the simulation
  kind: PieceKind; // what was simulated
  link: { type: "video"; analysisId: string } | { type: "text"; text: string; as: "hook" | "idea" | "opening" };
}

export interface ChatSummary {
  counts: { hooks: number; ideas: number; scripts: number; remixes: number; videos: number; texts: number };
  lead: PieceKind; // what the row is marked with and named for
  stage: Stage;
  sim: SimSummary | null; // the piece simulated last
  frame: string | null; // a stored frame of its video, if one is recorded
}

type TextAs = Extract<SimSummary["link"], { type: "text" }>["as"];

/** One card of the chat, with the key its seal is stored under ("" when it has nothing to simulate). */
export type Piece =
  | { kind: "video"; key: string; analysisId: string }
  | { kind: "hooks" | "ideas" | "script" | "remix" | "text"; key: string; as: TextAs };

const COUNT_OF: Record<Piece["kind"], keyof ChatSummary["counts"]> = {
  hooks: "hooks",
  ideas: "ideas",
  script: "scripts",
  remix: "remixes",
  video: "videos",
  text: "texts",
};

/**
 * A stored body's blocks: a bare blocks array, or the `{ kcGenVersion, blocks }` wrapper. Anything
 * else holds none. Repeated from `unwrapBody` (`src/lib/threads/messages.ts`), which is not exported
 * and sits beside the database clients.
 */
function blocksOf(body: unknown): readonly unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { blocks?: unknown }).blocks)) {
    return (body as { blocks: unknown[] }).blocks;
  }
  return [];
}

/** A script's opening line, the text its slot fires and looks up. Repeated from `openerOf`
 *  (`thread-turn-next.tsx`): the seed, else the first beat's content. */
function openerOf(block: ScriptCardBlock): string {
  return block.props.openingBeatSeed || block.props.beats[0]?.content || "";
}

const textPiece = (kind: Exclude<Piece["kind"], "video">, text: string, as: TextAs): Piece => ({ kind, key: sealKey(text), as });

/** Every piece of the chat in message and block order: one per card. */
export function piecesOf(bodies: readonly unknown[]): Piece[] {
  const pieces: Piece[] = [];
  if (!Array.isArray(bodies)) return pieces;
  for (const body of bodies) {
    for (const part of partsOf(blocksOf(body))) {
      switch (part.kind) {
        case "hooks":
          for (const { block } of part.items) pieces.push(textPiece("hooks", block.props.hookLine, "hook"));
          break;
        case "ideas":
          for (const { block } of part.items) pieces.push(textPiece("ideas", block.props.title, "idea"));
          break;
        case "remix":
          for (const { block } of part.items) pieces.push(textPiece("remix", block.props.adaptedHook, "hook"));
          break;
        case "script":
          pieces.push(textPiece("script", openerOf(part.item.block), "opening"));
          break;
        case "video": {
          // The card route seals a run under the same `analysisId` it puts on the card.
          const id = sealKey(part.item.block.props.analysisId);
          pieces.push({ kind: "video", key: id, analysisId: id });
          break;
        }
        case "fallback":
          // Brought text has no card of its own under the new look; its seal is keyed by the stimulus
          // the react route stores on it (`stimulus: text`, then `writeSimSeal(…, text, …)`).
          if (part.block.type === "brought-card") {
            pieces.push(textPiece("text", (part.block as BroughtCardBlock).props.stimulus, "hook"));
          }
          break;
      }
    }
  }
  return pieces;
}

/** The seal stored under `key`, own entries only (a card reading "constructor" finds nothing). */
function sealAt(seals: SimSealMap, key: string): SimSeal | null {
  if (!key || !seals || typeof seals !== "object") return null;
  return Object.prototype.hasOwnProperty.call(seals, key) ? (seals[key] ?? null) : null;
}

/** The result page's number for a video, from the heatmap its seal copied. Null when it cannot draw one. */
function videoNumberOf(seal: SimSeal, analysisId: string): number | null {
  if (!seal.video) return null;
  try {
    const audience = audienceOf({ id: analysisId, heatmap: seal.video.heatmap });
    if (!audience) return null;
    const { value } = headlineOf(audience);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  } catch {
    // A heatmap the parser let through (it checks the curve only) but that is broken inside.
    return null;
  }
}

/** The piece's simulation, when its seal carries a number the result page would show. */
function simOf(piece: Piece, seal: SimSeal | null): SimSummary | null {
  if (!seal) return null;
  if (piece.kind === "video") {
    const number = videoNumberOf(seal, piece.analysisId);
    if (number === null) return null;
    return { number, measure: "end", at: seal.at, kind: "video", link: { type: "video", analysisId: piece.analysisId } };
  }
  if (seal.video) return null;
  const number = stopNumberOf(seal);
  if (number === null) return null;
  return { number, measure: "stop", at: seal.at, kind: piece.kind, link: { type: "text", text: piece.key, as: piece.as } };
}

/** A stored time, for ordering; one that does not parse sorts before every real one. */
function timeOf(at: string): number {
  const t = Date.parse(at);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** The first stored frame address in a video seal's heatmap (the poster rule of the video card). */
function frameOf(seal: SimSeal | null): string | null {
  const segments = (seal?.video?.heatmap as { segments?: unknown } | undefined)?.segments;
  if (!Array.isArray(segments)) return null;
  for (const s of segments) {
    const uri = s && typeof s === "object" ? (s as { keyframe_uri?: unknown }).keyframe_uri : null;
    if (typeof uri === "string" && uri.length > 0) return uri;
  }
  return null;
}

/** `bodies`: each message's `body` as stored, oldest first. `seals`: the chat's simulation records. */
export function chatSummaryOf(bodies: readonly unknown[], seals: SimSealMap): ChatSummary {
  const pieces = piecesOf(bodies);
  const counts: ChatSummary["counts"] = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };
  let sim: SimSummary | null = null;
  let simTime = Number.NEGATIVE_INFINITY;
  let lastVideo: string | null = null;

  for (const piece of pieces) {
    counts[COUNT_OF[piece.kind]] += 1;
    if (piece.kind === "video") lastVideo = piece.key;
    const found = simOf(piece, sealAt(seals, piece.key));
    // The latest time wins; on a tie (one seal, two cards), the later card.
    if (found && timeOf(found.at) >= simTime) {
      sim = found;
      simTime = timeOf(found.at);
    }
  }

  const last = pieces[pieces.length - 1];
  const frameVideo = sim ? (sim.link.type === "video" ? sim.link.analysisId : null) : lastVideo;
  return {
    counts,
    lead: sim?.kind ?? last?.kind ?? "chat",
    stage: sim ? "simulated" : last ? "draft" : "chat",
    sim,
    frame: frameVideo ? frameOf(sealAt(seals, frameVideo)) : null,
  };
}

// The words a row says them in live in a leaf (`piece-words.ts`), so the screens that say them do
// not take this module's imports (the block registry) into their bundle.
export { insideLabel, measureWords } from "./piece-words";
