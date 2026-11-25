/**
 * row-proof.ts — the line a hook's row shows under its text for the one real video it is built on
 * (thread depth spec §3.3): "@handle · 854K views", or "@handle" without views, and the video's
 * cover when it has one. The views go through `viewsLabel`, the formatter the sheet's proof row and
 * the remix card already use, so one count never reads two ways. Handles are stored without the
 * "@" (a stray one is not doubled). A receipt with no handle names nothing: no line.
 *
 * Pure: no React.
 */

import { viewsLabel } from "@/lib/multiple-words";
import type { HookProof } from "@/lib/tools/blocks";

export interface RowProof {
  /** The video's cover; null: the words alone. */
  cover: string | null;
  line: string;
}

export function rowProofOf(proof: HookProof | null | undefined): RowProof | null {
  if (!proof) return null;
  const handle = proof.handle.trim().replace(/^@+/, "").trim();
  if (handle.length === 0) return null;
  const views = typeof proof.views === "number" && Number.isFinite(proof.views) ? ` · ${viewsLabel(proof.views)} views` : "";
  return { cover: proof.coverUrl?.trim() || null, line: `@${handle}${views}` };
}
