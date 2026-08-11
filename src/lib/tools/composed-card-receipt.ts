/**
 * composed-card-receipt.ts — D7: the model names a teardown row, the SERVER materializes the
 * numbers. The model never authors a handle or a multiplier.
 *
 * The composition spike printed 31 receipts with 0 fabricated handles. That was empirical —
 * luck, measured once, on two models. This module makes it structural: the composer's only
 * receipt input is a row id, and an id that does not resolve yields no receipt at all. A
 * fabricated handle cannot reach the DOM because the model is never asked for one.
 *
 * Honesty rules are the shipped ones, imported rather than re-rolled:
 *   - no baseline_label ⇒ NO number (hasKnownBaseline; D9 "never a bare multiplier")
 *   - no handle ⇒ no receipt (§0.5b "An unattributable source is not a receipt")
 *   - a non-positive or non-finite multiplier ⇒ no number (mirrors honestMultiplier in
 *     retrieve.ts: absent is honest, 0× asserts the video performed zero times its baseline)
 *   - fitLabel is ALWAYS null here: nothing measured this row against this creator's audience,
 *     and a fit glyph is a claim retrieval earns (§0.5b).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCorpusClient } from "@/lib/grounding/corpus";
import { hasKnownBaseline } from "@/lib/grounding/retrieve";
import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";
import type { HookProof } from "@/lib/tools/proof-schema";

/** The columns this seam reads — verified against the production `outlier_teardowns` table. */
const RECEIPT_COLUMNS =
  "id, creator_handle, video_url, cover_url, hook_template, hook_archetype, outlier_multiplier, views, baseline_label";

interface TeardownReceiptRow {
  id: string;
  creator_handle: string | null;
  video_url: string | null;
  cover_url: string | null;
  hook_template: string | null;
  hook_archetype: string | null;
  outlier_multiplier: number | null;
  views: number | null;
  baseline_label: string | null;
}

/**
 * The printable number, or none. Above the band ceiling it clamps rather than dropping the row
 * — an out-of-band ratio is still a usable exemplar, it just may not print its own arithmetic.
 */
function bandedMultiplier(m: number | null): number | null {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) return null;
  return m > MAX_PRINTABLE_MULTIPLIER ? MAX_PRINTABLE_MULTIPLIER : m;
}

/**
 * Resolve teardown row ids to real receipts. Ids that do not resolve are simply absent from the
 * map — the caller renders no receipt for them (spec §5), never a placeholder.
 *
 * Degrade-safe by design: a query error returns an empty map instead of throwing, because a
 * card that loses its receipt strip is a worse card, while a card that throws is no card.
 */
export async function materializeReceipts(
  ids: string[],
  deps: { supabase?: SupabaseClient } = {},
): Promise<Map<string, HookProof>> {
  const out = new Map<string, HookProof>();
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
  if (unique.length === 0) return out;

  const supabase = deps.supabase ?? getCorpusClient();
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .select(RECEIPT_COLUMNS)
    .in("id", unique);

  if (error || !Array.isArray(data)) return out;

  for (const row of data as unknown as TeardownReceiptRow[]) {
    // §0.5b: no handle → no receipt. An unattributable source is not a receipt.
    if (!row.creator_handle) continue;

    const basisKnown = hasKnownBaseline({ baseline_label: row.baseline_label });
    out.set(row.id, {
      handle: row.creator_handle,
      videoUrl: row.video_url,
      coverUrl: row.cover_url,
      hookTemplate: row.hook_template,
      archetype: row.hook_archetype,
      // D9: a multiplier with no nameable basis is a boast with nothing behind it.
      multiplier: basisKnown ? bandedMultiplier(row.outlier_multiplier) : null,
      baselineLabel: basisKnown ? row.baseline_label : null,
      // views needs no basis — it is an absolute count, not a ratio — so it survives a row
      // whose multiplier does not.
      views: typeof row.views === "number" && Number.isFinite(row.views) ? row.views : null,
      fitLabel: null,
    });
  }

  return out;
}
