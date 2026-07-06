/**
 * Phase 10 Plan 02 — reconciliations CRUD (FLYWHEEL-03/05, cross-creator SEED).
 *
 * Typed CRUD over the reconciliations table. Mirrors audience-repo.ts:
 *  - SupabaseClient param, zod-validated insert shape.
 *  - user_id ALWAYS derived from the session (CR-01) — NEVER from caller input.
 *  - follower_tier is a BUCKET string, never a raw count (privacy, T-10-04).
 *
 * Rails only — the cross-creator prior-fitting job is NOT built here (RESEARCH §8).
 *
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { GoalIntent } from "@/lib/audience/audience-types";
import type { DivergenceClass } from "./reconcile";
import type { DispositionVector, RawMetrics } from "./outcome-repo";

// ─── Domain shapes ───────────────────────────────────────────────────────────

export type ProposalState = "logged" | "proposed" | "confirmed" | "declined";
export type Classification = Partial<Record<string, DivergenceClass>>;

/** A persisted reconciliations row, in domain form. */
export interface Reconciliation {
  id: string;
  user_id: string;
  outcome_signature_id: string | null;
  audience_id: string | null;
  niche: string | null;
  goal_intent: GoalIntent | null;
  follower_tier: string | null;
  predicted_vector: DispositionVector;
  realized_vector: DispositionVector;
  divergence_vector: DispositionVector;
  classification: Classification;
  proposal_state: ProposalState;
  proposed_delta: Record<string, number> | null;
  confirmed_at: string | null;
  created_at: string;
}

/**
 * The public, glanceable slice of the linked outcome_signatures row — the "actual" side
 * of a receipt: where the post lives + the raw public numbers it was measured from.
 * (The reconciliation itself only stores normalized vectors; the real counts live here.)
 */
export interface OutcomeMetrics {
  platform_post_url: string | null;
  posted_at: string | null;
  raw_metrics: RawMetrics | null;
}

/**
 * A reconciliation enriched with its linked outcome signature (the /start "the loop" feed row).
 * `outcome` is OPTIONAL so a bare `Reconciliation` stays structurally assignable (tests, callers
 * that don't join) — absent/null when the FK is null or the signature couldn't be embedded.
 */
export interface LoopRow extends Reconciliation {
  outcome?: OutcomeMetrics | null;
}

/** Writable insert shape — user_id is NEVER part of it (CR-01, session-derived). */
export interface ReconciliationInput {
  outcome_signature_id?: string | null;
  audience_id?: string | null;
  niche?: string | null;
  goal_intent?: GoalIntent | null;
  follower_tier?: string | null;
  predicted_vector: DispositionVector;
  realized_vector: DispositionVector;
  divergence_vector: DispositionVector;
  classification: Classification;
  proposal_state?: ProposalState;
  proposed_delta?: Record<string, number> | null;
  confirmed_at?: string | null;
}

// ─── Zod validation ──────────────────────────────────────────────────────────

const DispositionVectorSchema = z.record(z.string(), z.number());

const ReconciliationInputSchema = z.object({
  outcome_signature_id: z.string().uuid().nullable().optional(),
  audience_id: z.string().uuid().nullable().optional(),
  niche: z.string().nullable().optional(),
  goal_intent: z.enum(["grow", "sell", "authority", "nurture"]).nullable().optional(),
  follower_tier: z.string().nullable().optional(),
  predicted_vector: DispositionVectorSchema,
  realized_vector: DispositionVectorSchema,
  divergence_vector: DispositionVectorSchema,
  classification: z.record(z.string(), z.enum(["calibration", "craft"])),
  proposal_state: z.enum(["logged", "proposed", "confirmed", "declined"]).optional(),
  proposed_delta: z.record(z.string(), z.number()).nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Insert one reconciliation row. user_id is derived from the session (CR-01).
 */
export async function insertReconciliation(
  supabase: SupabaseClient,
  input: ReconciliationInput,
): Promise<Reconciliation> {
  const parsed = ReconciliationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`invalid reconciliation input: ${parsed.error.message}`);
  }

  // CR-01: derive user_id from session, NEVER from input.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const payload = { ...parsed.data, user_id: user.id };

  const { data, error } = await supabase
    .from("reconciliations")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`reconciliations insert failed: ${error.message}`);
  }

  return data as Reconciliation;
}

/**
 * List reconciliations for one audience (the confidence-gate's input rows),
 * newest first. RLS scopes to the authenticated user.
 */
export async function listReconciliations(
  supabase: SupabaseClient,
  audienceId: string,
): Promise<Reconciliation[]> {
  const { data, error } = await supabase
    .from("reconciliations")
    .select("*")
    .eq("audience_id", audienceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`reconciliations list failed: ${error.message}`);
  }

  return (data ?? []) as Reconciliation[];
}

/**
 * List the user's most recent reconciliations ACROSS all audiences (newest first, capped) —
 * the /start "the loop" feed. RLS scopes to the authenticated user (no audience filter).
 *
 * Embeds the linked outcome_signatures row (many-to-one via `outcome_signature_id`) so each
 * receipt can show the REAL public numbers + a link to the actual post — the "actual" half of
 * predicted-vs-actual. The embed rides the same RLS (both tables are own-rows-only) and returns
 * a single object (or null) per row. Total: returns [] on error (the loop degrades to its honest
 * empty state, never throws up).
 */
export async function listRecentReconciliations(
  supabase: SupabaseClient,
  limit = 8,
): Promise<LoopRow[]> {
  try {
    const { data, error } = await supabase
      .from("reconciliations")
      .select("*, outcome_signatures(platform_post_url, posted_at, raw_metrics)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []).map((raw): LoopRow => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { outcome_signatures, ...rec } = raw as any;
      return {
        ...(rec as Reconciliation),
        outcome: (outcome_signatures as OutcomeMetrics | null) ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Update a reconciliation's proposal_state (logged→proposed→confirmed/declined).
 * Pass confirmedAt when transitioning to 'confirmed'. RLS scopes to the owner.
 */
export async function updateProposalState(
  supabase: SupabaseClient,
  id: string,
  state: ProposalState,
  confirmedAt?: string,
): Promise<Reconciliation> {
  const patch: Record<string, unknown> = { proposal_state: state };
  if (confirmedAt !== undefined) patch.confirmed_at = confirmedAt;

  const { data, error } = await supabase
    .from("reconciliations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`reconciliations updateProposalState failed: ${error.message}`);
  }

  return data as Reconciliation;
}
