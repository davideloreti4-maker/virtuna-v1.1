/**
 * read-rollup.ts — roll a user's persisted Reads up to ONE audience (ROLLUP-01, P2).
 *
 * The /audience workspace wants two data-backed panels:
 *   - per-persona quotes   — each persona's LAST real reaction from your Reads
 *   - the divergence panel — "12 Reads · your people disagreed with the generic crowd 4 times"
 *
 * Both live inside `multi-audience-read` blocks in thread-message JSONB. There is no
 * scores table; this module is the query.
 *
 * ── Three things that will bite anyone who edits this ────────────────────────────────
 *
 * 1. THE BODY IS NOT AN ARRAY. `insertMessage` writes `{kcGenVersion, blocks:[…]}` whenever
 *    a KC stamp is supplied (messages.ts:95) — and every tools route supplies one. So ALL 7
 *    Read blocks in the live DB sit in the wrapper shape and ZERO in the bare-array shape.
 *    The obvious containment query — `body @> '[{"type":"multi-audience-read"}]'` — matches
 *    NOTHING and looks exactly like "this user has no Reads yet". Unwrap both shapes.
 *
 * 2. ATTRIBUTION IS BY ID, NEVER BY NAME. A block entry's `name` is a user-editable display
 *    string. Keying the rollup on it would silently re-attribute history on rename, and would
 *    attach a deleted audience's Reads to a DIFFERENT audience later recreated under the same
 *    name. Blocks written before ROLLUP-01 carry no `audienceId`; they are COUNTED AND
 *    REPORTED (`legacyUnattributed`), never guessed at.
 *
 * 3. THE LEGACY BLOCKS ARE NOT MERELY UN-ATTRIBUTED — THEY ARE WRONG. Every one predates
 *    #281, when the Read ran the IDENTICAL prompt for both sides and relabelled one of them.
 *    4 of the 5 two-sided rows in the live DB agree on both sides for exactly that reason.
 *    Folding them into a divergence panel would report "your people agreed with the generic
 *    crowd" — a bug, rendered as a finding. Excluding them is required for the panel to be
 *    true, not merely tidy.
 *
 * ── And the one that will bite the UI ────────────────────────────────────────────────
 *
 * 4. A MATCHING BAND IS NOT AGREEMENT. The band aggregates 10 persona verdicts, so offsetting
 *    flips collide. The first live Read of this feature had Zach King's crowd and General both
 *    at Strong 7/10 — while disagreeing about WHICH people stopped. Report `personaDiverged`
 *    (at least one persona wanted something different) alongside `diverged` (the aggregate
 *    moved), or the panel will announce agreement on Reads that plainly disagreed.
 *
 * Honesty spine (F3): bands only — Strong | Mixed | Weak, and stop/scroll verdicts. This module
 * never computes, derives, or returns a numeric score, and the block's `.strict()` rejects one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { MultiAudienceReadBlockSchema } from "@/lib/tools/blocks";
import type { MultiAudienceReadBlock } from "@/lib/tools/blocks";

/** Band vocabulary — the ONLY verdict currency (F3). Never a 0-100. */
export type ReadBand = MultiAudienceReadBlock["props"]["audiences"][number]["band"];

/** One persona's most recent reaction to any concept read against this audience. */
export interface PersonaReaction {
  archetype: string;
  verdict: "stop" | "scroll";
  quote: string;
  /** ISO timestamp of the Read this reaction came from. */
  at: string;
}

/** One persona that reacted DIFFERENTLY for the two audiences in the same Read. */
export interface PersonaFlip {
  archetype: string;
  mine: "stop" | "scroll";
  other: "stop" | "scroll";
}

/** One concept read against this audience AND a second one — the divergence unit. */
export interface DivergenceCase {
  /** What was read. `null` for blocks written before the concept was persisted. */
  concept: string | null;
  at: string;
  mine: { name: string; band: ReadBand };
  other: { name: string; band: ReadBand };
  /**
   * Band-level agreement: did the two audiences land on the same overall verdict?
   *
   * ⚠️ AGREEING ON THE BAND IS NOT AGREEING. Bands are an aggregate of 10 persona verdicts,
   * so OFFSETTING FLIPS COLLIDE: in the first live Read of this feature, Zach King's crowd and
   * General both landed Strong at 7/10 — while disagreeing about WHICH people stopped
   * (niche_deep_buyer stopped for Zach and scrolled for General; tough_crowd did the reverse).
   * A panel that reports only this field would have called that Read "agreed" and thrown the
   * real disagreement away. Always read it beside `personaFlips`.
   */
  agreed: boolean;
  /**
   * The personas whose verdict actually differed between the two audiences, paired by
   * ARCHETYPE (the binding key — #282), never by array position. THIS is the signal the
   * divergence panel exists to show: not "the score moved" but "your people and the generic
   * crowd want different things." Empty → the two sides agreed persona-for-persona.
   */
  personaFlips: PersonaFlip[];
}

export interface AudienceReadRollup {
  audienceId: string;
  /** Reads that included this audience (single-audience Reads count too). */
  reads: number;
  /** Latest reaction per archetype, newest first. At most one entry per archetype. */
  personas: PersonaReaction[];
  /** Reads where this audience was compared against a second one. */
  compared: number;
  /**
   * Of those, how many landed on a DIFFERENT BAND. This is the coarse headline, and it
   * UNDER-REPORTS disagreement by design — see DivergenceCase.agreed. Prefer
   * `personaDiverged` for "how often did my people want something different".
   */
  diverged: number;
  /**
   * Of `compared`, how many Reads had AT LEAST ONE persona flip — the two audiences wanted
   * different things, whether or not the aggregate band happened to collide. This is the
   * honest divergence count, and it is >= `diverged`.
   */
  personaDiverged: number;
  /** The divergence cases themselves, newest first, capped at CASE_LIMIT. */
  cases: DivergenceCase[];
  /**
   * Read blocks carrying NO `audienceId` on any entry — written before ROLLUP-01, so they
   * cannot be attributed to an audience without guessing by display name. They are excluded
   * from every count above. Surfaced (never swallowed) so the UI can say so out loud rather
   * than quietly under-reporting.
   */
  legacyUnattributed: number;
  /** Assistant messages scanned. */
  scanned: number;
  /** True when the scan hit SCAN_LIMIT — older Reads exist beyond this window. */
  scanCapped: boolean;
}

/**
 * Most-recent assistant messages scanned per rollup. Reads are rare relative to chat turns,
 * so this window is generous in practice (the whole live DB holds 81 message rows). It is a
 * REAL cap, not a silent one: hitting it sets `scanCapped`, and the caller is expected to say
 * so rather than present a truncated history as a complete one.
 */
export const SCAN_LIMIT = 500;

/** Max divergence cases returned. The counts (`compared`/`diverged`) are NOT capped. */
export const CASE_LIMIT = 20;

/**
 * Normalise a persisted message body to its blocks array.
 *
 * Mirrors `unwrapBody` in threads/messages.ts — BOTH shapes are live in the DB:
 *   - `{kcGenVersion, blocks:[…]}` — every KC-stamped write, which is every Read (all 7 live)
 *   - `[…]`                        — the bare array (older/unstamped writes)
 */
function unwrapBody(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { blocks?: unknown }).blocks)) {
    return (body as { blocks: unknown[] }).blocks;
  }
  return [];
}

/**
 * Roll every persisted Read that included `audienceId` up into per-persona reactions and
 * audience-vs-other divergence.
 *
 * `supabase` MUST be the RLS-scoped session client: the messages_select_own policy is what
 * confines the scan to the caller's own threads. Never pass the service client here.
 */
export async function rollupReadsForAudience(
  supabase: SupabaseClient,
  audienceId: string,
): Promise<AudienceReadRollup> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, created_at, body")
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);

  if (error) {
    throw new Error(`rollupReadsForAudience: query failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: string; created_at: string; body: unknown }>;

  const rollup: AudienceReadRollup = {
    audienceId,
    reads: 0,
    personas: [],
    compared: 0,
    diverged: 0,
    personaDiverged: 0,
    cases: [],
    legacyUnattributed: 0,
    scanned: rows.length,
    scanCapped: rows.length >= SCAN_LIMIT,
  };

  // Rows arrive NEWEST FIRST, so the first reaction seen for an archetype is its latest one.
  const latestByArchetype = new Map<string, PersonaReaction>();

  for (const row of rows) {
    for (const raw of unwrapBody(row.body)) {
      // Parse against the REAL schema rather than trusting the raw JSONB shape. A block that
      // fails (hand-edited row, a future shape) is skipped, never half-read.
      const parsed = MultiAudienceReadBlockSchema.safeParse(raw);
      if (!parsed.success) continue;

      const entries = parsed.data.props.audiences;

      // ATTRIBUTION — by id, never by name (see header note 2).
      const mine = entries.find((e) => e.audienceId === audienceId);
      if (!mine) {
        // No entry carries an id at all → a pre-ROLLUP-01 block. Report it; do not guess.
        // (An entry that HAS ids but none of them ours simply belongs to other audiences.)
        if (entries.every((e) => e.audienceId === undefined)) rollup.legacyUnattributed += 1;
        continue;
      }

      rollup.reads += 1;

      for (const p of mine.personas) {
        if (!latestByArchetype.has(p.archetype)) {
          latestByArchetype.set(p.archetype, {
            archetype: p.archetype,
            verdict: p.verdict,
            quote: p.quote,
            at: row.created_at,
          });
        }
      }

      // DIVERGENCE — only a genuinely two-sided Read has any. A single-audience Read (the
      // self-pair collapse in two-audience-read.ts) was compared against NOTHING; counting it
      // as agreement would invent a second opinion that was never asked for.
      const other = entries.find((e) => e !== mine);
      if (!other) continue;

      // Cross-mode pairs are refused at the route (400 audience_mode_mismatch) precisely
      // because the two sides are asked different questions, so anything that reaches here is
      // a like-for-like comparison and its band delta is a fact about the concept.
      const agreed = mine.band === other.band;

      // Pair the two sides' personas by ARCHETYPE — the binding key (#282) — never by array
      // position: the two Flash runs are independent and carry no ordering guarantee, so
      // zipping by index would compare a saver's verdict against a lurker's and invent flips
      // that never happened. An archetype missing from one side is skipped, not guessed.
      const otherVerdict = new Map(other.personas.map((p) => [p.archetype, p.verdict]));
      const personaFlips: PersonaFlip[] = [];
      for (const p of mine.personas) {
        const theirs = otherVerdict.get(p.archetype);
        if (theirs !== undefined && theirs !== p.verdict) {
          personaFlips.push({ archetype: p.archetype, mine: p.verdict, other: theirs });
        }
      }

      rollup.compared += 1;
      if (!agreed) rollup.diverged += 1;
      if (personaFlips.length > 0) rollup.personaDiverged += 1;

      if (rollup.cases.length < CASE_LIMIT) {
        rollup.cases.push({
          concept: parsed.data.props.concept ?? null,
          at: row.created_at,
          mine: { name: mine.name, band: mine.band },
          other: { name: other.name, band: other.band },
          agreed,
          personaFlips,
        });
      }
    }
  }

  rollup.personas = [...latestByArchetype.values()].sort((a, b) => b.at.localeCompare(a.at));

  return rollup;
}
