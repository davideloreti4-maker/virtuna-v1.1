/**
 * text-seal.ts — the stored text simulation behind a result page's key (thread answers step 2, spec §4).
 *
 * The key is `sealHashOf(text)`, so the seal is found by hashing each text seal of the chat. Only a seal
 * the text result page serves can match: no video depth, and a number (`stopNumberOf`). One function for
 * `GET /api/threads/[id]/seals/[key]` (the page) and for what Maven said about a posted piece
 * (`src/lib/posted/piece-said.ts`), so the two cannot disagree on which seal a key means.
 *
 * Pure: no React, no I/O.
 */

import type { SimSeal, SimSealMap } from "@/lib/threads/sim-seals";
import { sealHashOf } from "./seal-hash";
import { stopNumberOf } from "./stop-number";

/** The text seal whose result-page key is `key`, with the text it is stored under and the number its page
 *  shows (`stopNumberOf`); null when none is. */
export async function textSealOfKey(seals: SimSealMap, key: string): Promise<{ text: string; seal: SimSeal; number: number } | null> {
  for (const [text, seal] of Object.entries(seals)) {
    const number = seal.video ? null : stopNumberOf(seal);
    if (number === null) continue;
    if ((await sealHashOf(text)) === key) return { text, seal, number };
  }
  return null;
}
