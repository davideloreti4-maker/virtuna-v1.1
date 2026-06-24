/**
 * GET /api/cron/audience-drift — scheduled own-account re-scrape → drift outcome_signature.
 *
 * The DRIFT half of the flywheel (FLYWHEEL-06). D-01: drift is NOT a separate mechanism —
 * a composition shift is just another disposition divergence, so a drift re-scrape writes
 * an `outcome_signatures` row with `source='drift_scrape'` and flows through the SAME
 * `reconcile` + reconciliation-log + confidence-gate + propose path as outcome capture.
 *
 * For each PERSONAL audience (own-account, has a calibration.handle):
 *   1. Re-scrape the own account (calibrateFromScrape → scrapeProfile + scrapeVideos +
 *      enrichSignature) → fresh CalibratedPersona[].
 *   1b. RE-BAKE the frozen signature (Track B step 9, §P.1): persist the freshly-derived
 *      signature + creator_persona + legacy profile/personas/calibration back to the row.
 *      This cron is the ONLY place the frozen §P signature re-bakes (intentional —
 *      determinism is contained to the bake). persona_weights is NOT written here: it's the
 *      flywheel's analysis_override slot (propose.ts), kept orthogonal to the reality refresh.
 *   2. Build a fresh COMPOSITION disposition vector (realized) by aggregating the fresh
 *      personas' shares per disposition.
 *   3. The PREDICTED (stored) vector = the same aggregation over the audience's CURRENT
 *      stored personas — the mix we last calibrated to.
 *   4. Honesty spine (mirrors P7 thin gate): a thin re-scrape (calibrateFromScrape returns
 *      a fallback/error) writes NO drift row — we never fabricate a shift.
 *   5. A composition shift (realized ≠ predicted) → write an outcome_signatures row
 *      source='drift_scrape' (realized=fresh, predicted=stored) → reconcile → log row
 *      proposal_state='logged'. The gate + nudge then surface it like any outcome divergence.
 *
 * Skips is_general / preset audiences (regression gate — they never recalibrate).
 *
 * Security (T-10-17 spoofing): verifyCronAuth + CRON_SECRET gate the route FIRST.
 * createServiceClient() bypasses RLS (background job) — user_id is read from each
 * audience row, never from request input. Inline .call({waitSecs}) per scrape is fine
 * for v1 (cron tolerates latency; respect the function maxDuration).
 *
 * Cadence [ASSUMED] A4: weekly Monday 05:00 ("0 5 * * 1") — owner-tunable (RESEARCH §7).
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import {
  calibrateFromScrape,
  type CalibrationResult,
} from "@/lib/audience/calibration";
import { reconcile } from "@/lib/flywheel/reconcile";
import type { DispositionVector } from "@/lib/flywheel/outcome-repo";
import type {
  CalibratedPersona,
  Disposition,
  GoalIntent,
} from "@/lib/audience/audience-types";

const log = createLogger({ module: "cron/audience-drift" });

// Re-scraping multiple personal audiences serially can exceed the default function budget.
export const maxDuration = 300;

/**
 * Aggregate a CalibratedPersona[] into a disposition share vector (sums to ~1.0).
 * Each persona contributes its `share` to its `disposition`. An empty list → empty vector
 * (honest — no fabricated dispositions).
 */
function compositionVector(personas: CalibratedPersona[]): DispositionVector {
  const vector: Partial<Record<Disposition, number>> = {};
  for (const p of personas) {
    vector[p.disposition] = (vector[p.disposition] ?? 0) + p.share;
  }
  return vector;
}

/** True when two disposition vectors differ on any shared key (a composition shift). */
function hasShift(
  predicted: DispositionVector,
  realized: DispositionVector,
): boolean {
  const keys = new Set([...Object.keys(predicted), ...Object.keys(realized)]);
  for (const k of keys) {
    const p = predicted[k as Disposition] ?? 0;
    const r = realized[k as Disposition] ?? 0;
    if (Math.abs(r - p) > 1e-6) return true;
  }
  return false;
}

/** A minimal audience row shape we read from the service client (RLS bypassed). */
interface PersonalAudienceRow {
  id: string;
  user_id: string;
  type: string;
  is_general: boolean;
  is_preset: boolean;
  goal_intent: string | null;
  personas: CalibratedPersona[] | null;
  calibration: { handle?: string } | null;
  platform: string;
  name: string;
}

/**
 * GET /api/cron/audience-drift
 *
 * Cron-authed. Re-scrapes each personal audience's own account and writes a drift_scrape
 * outcome row + reconciliation when the composition has shifted. Returns a per-audience
 * summary (scanned / drifted / skipped) — never echoes scraped content.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();

  try {
    // Personal, own-account audiences only — never General/preset (regression gate).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any) // TODO(10-07): remove cast after types regen
      .from("audiences")
      .select(
        "id, user_id, type, is_general, is_preset, goal_intent, personas, calibration, platform, name",
      )
      .eq("type", "personal")
      .eq("is_general", false)
      .eq("is_preset", false);

    if (error) {
      throw new Error(`audiences query failed: ${error.message}`);
    }

    const audiences = ((data ?? []) as PersonalAudienceRow[]).filter(
      (a) => !a.is_general && !a.is_preset && a.calibration?.handle,
    );

    let scanned = 0;
    let drifted = 0;
    let rebaked = 0;
    let skipped = 0;

    for (const audience of audiences) {
      scanned += 1;
      const handle = audience.calibration?.handle;
      if (!handle) {
        skipped += 1;
        continue;
      }

      // ── Re-scrape the own account (fresh composition) ──────────────────────
      let result: CalibrationResult;
      try {
        result = await calibrateFromScrape({
          handle,
          type: "personal",
          platform: (audience.platform ?? "tiktok") as never,
          goalIntent: (audience.goal_intent ?? "grow") as GoalIntent,
          name: audience.name,
        });
      } catch (err) {
        // A scrape failure for one audience never blocks the rest.
        log.warn("drift re-scrape failed", {
          audienceId: audience.id,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped += 1;
        continue;
      }

      // Honesty spine: a thin/failed re-scrape writes NO drift row (never fabricate a shift).
      if (!("audience" in result)) {
        skipped += 1;
        continue;
      }

      // ── RE-BAKE the frozen signature (Track B step 9) ──────────────────────
      // §P.1: the weekly drift cron is the ONLY place the frozen signature re-bakes.
      // Every clean (non-thin) re-scrape refreshes the row's signature + creator_persona
      // + the derived legacy fields (profile/personas/calibration) to current reality, so
      // the per-skill hot path reads a fresh-but-still-frozen artifact. persona_weights is
      // DELIBERATELY NOT written here — it's the flywheel's analysis_override slot
      // (propose.ts confirmProposal), so the reality-refresh loop (voice/dispositions) stays
      // orthogonal to the learned-nudge loop (weights). A re-bake failure is logged but never
      // blocks drift detection below (the two are independent signals).
      const fresh = result.audience;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rebakeErr } = await (supabase as any) // TODO(10-07): remove cast after types regen
        .from("audiences")
        .update({
          signature: fresh.signature,
          creator_persona: fresh.creator_persona,
          profile: fresh.profile,
          personas: fresh.personas,
          calibration: fresh.calibration,
        })
        .eq("id", audience.id);

      if (rebakeErr) {
        log.warn("drift re-bake (signature persist) failed", {
          audienceId: audience.id,
          error: rebakeErr.message,
        });
      } else {
        rebaked += 1;
      }

      // ── Drift detection (predicted = the OLD stored mix, read before the re-bake) ──
      const freshPersonas = result.audience.personas ?? [];
      const storedPersonas = audience.personas ?? [];

      const realized = compositionVector(freshPersonas); // fresh mix
      const predicted = compositionVector(storedPersonas); // mix we calibrated to

      // No stored mix or no shift → nothing to propose (honest, same gate as outcome).
      if (storedPersonas.length === 0 || !hasShift(predicted, realized)) {
        skipped += 1;
        continue;
      }

      // ── Write the drift outcome_signature row (source='drift_scrape') ───────
      // user_id is derived from session inside the repo — but this is a service-role
      // background job with no session. Insert the row directly with the audience's user_id.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: outcomeRow, error: outcomeErr } = await (supabase as any) // TODO(10-07): remove cast
        .from("outcome_signatures")
        .insert({
          user_id: audience.user_id,
          audience_id: audience.id,
          predicted_vector: predicted,
          realized_vector: realized,
          source: "drift_scrape",
        })
        .select("id")
        .single();

      if (outcomeErr) {
        log.warn("drift outcome insert failed", {
          audienceId: audience.id,
          error: outcomeErr.message,
        });
        skipped += 1;
        continue;
      }

      // ── SAME reconcile + log path as outcome capture (D-01) ─────────────────
      const reconciliation = reconcile(predicted, realized);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: recErr } = await (supabase as any) // TODO(10-07): remove cast
        .from("reconciliations")
        .insert({
          user_id: audience.user_id,
          outcome_signature_id: outcomeRow.id,
          audience_id: audience.id,
          goal_intent: audience.goal_intent,
          predicted_vector: predicted,
          realized_vector: realized,
          divergence_vector: reconciliation.divergenceVector,
          classification: reconciliation.classification,
          proposal_state: "logged",
        });

      if (recErr) {
        log.warn("drift reconciliation insert failed", {
          audienceId: audience.id,
          error: recErr.message,
        });
        skipped += 1;
        continue;
      }

      drifted += 1;
    }

    return NextResponse.json({
      success: true,
      scanned,
      rebaked,
      drifted,
      skipped,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    log.error("audience-drift cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "audience-drift cron failed" },
      { status: 500 },
    );
  }
}
