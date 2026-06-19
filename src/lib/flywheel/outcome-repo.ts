/**
 * Phase 10 Plan 02 — outcome_signatures CRUD (FLYWHEEL-01/02).
 *
 * Typed CRUD over the outcome_signatures table. Mirrors audience-repo.ts:
 *  - SupabaseClient param, row↔domain mappers, zod-validated insert shape.
 *  - user_id ALWAYS derived from the session (CR-01) — NEVER from caller input.
 *
 * Cast convention: `(supabase as any).from('outcome_signatures')` until
 * database.types.ts is regenerated after the migration push in Plan 07
 * (STATE 07-02 interim pattern). TODO(10-07): remove cast after types regen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Disposition } from "@/lib/audience/audience-types";
import type { MetricSource } from "./realized-signature";

// ─── Domain shapes ───────────────────────────────────────────────────────────

export type DispositionVector = Partial<Record<Disposition, number>>;
export type OutcomeSource = "paste_url" | "drift_scrape";

/** Per-channel provenance for a realized signature. */
export type RealizedProvenance = Partial<Record<string, MetricSource>>;

/** Raw post metrics the realized vector was derived from (any channel may be absent). */
export interface RawMetrics {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  watch_through_pct?: number | null;
  link_clicks?: number | null;
}

/** A persisted outcome_signatures row, in domain form. */
export interface OutcomeSignature {
  id: string;
  user_id: string;
  analysis_id: string | null;
  audience_id: string | null;
  platform_post_url: string | null;
  posted_at: string | null;
  predicted_vector: DispositionVector;
  realized_vector: DispositionVector | null;
  realized_provenance: RealizedProvenance | null;
  raw_metrics: RawMetrics | null;
  source: OutcomeSource;
  created_at: string;
}

/** Writable insert shape — user_id is NEVER part of it (CR-01, session-derived). */
export interface OutcomeSignatureInput {
  analysis_id?: string | null;
  audience_id?: string | null;
  platform_post_url?: string | null;
  posted_at?: string | null;
  predicted_vector: DispositionVector;
  realized_vector?: DispositionVector | null;
  realized_provenance?: RealizedProvenance | null;
  raw_metrics?: RawMetrics | null;
  source?: OutcomeSource;
}

// ─── Zod validation ──────────────────────────────────────────────────────────

const DispositionVectorSchema = z.record(z.string(), z.number());

const OutcomeSignatureInputSchema = z.object({
  analysis_id: z.string().nullable().optional(),
  audience_id: z.string().uuid().nullable().optional(),
  platform_post_url: z.string().url().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  predicted_vector: DispositionVectorSchema,
  realized_vector: DispositionVectorSchema.nullable().optional(),
  realized_provenance: z.record(z.string(), z.string()).nullable().optional(),
  raw_metrics: z.record(z.string(), z.number().nullable()).nullable().optional(),
  source: z.enum(["paste_url", "drift_scrape"]).optional(),
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Insert one outcome signature. user_id is derived from the session (CR-01).
 */
export async function insertOutcomeSignature(
  supabase: SupabaseClient,
  input: OutcomeSignatureInput,
): Promise<OutcomeSignature> {
  const parsed = OutcomeSignatureInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`invalid outcome signature input: ${parsed.error.message}`);
  }

  // CR-01: derive user_id from session, NEVER from input.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const payload = { ...parsed.data, user_id: user.id };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any) // TODO(10-07): remove cast after types regen
    .from("outcome_signatures")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`outcome_signatures insert failed: ${error.message}`);
  }

  return data as OutcomeSignature;
}

/**
 * List outcome signatures for one audience (the confidence-gate's K rows),
 * newest first. RLS scopes to the authenticated user.
 */
export async function listOutcomeSignatures(
  supabase: SupabaseClient,
  audienceId: string,
): Promise<OutcomeSignature[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any) // TODO(10-07): remove cast after types regen
    .from("outcome_signatures")
    .select("*")
    .eq("audience_id", audienceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`outcome_signatures list failed: ${error.message}`);
  }

  return (data ?? []) as OutcomeSignature[];
}
