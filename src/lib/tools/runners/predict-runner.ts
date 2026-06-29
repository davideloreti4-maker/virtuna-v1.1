/**
 * predict-runner.ts — Phase 6 Plan 05 Task 1 (PRED-01 / PRED-03).
 *
 * `runPredict` is the Predict verb: a business scenario runs through a General
 * ANALYST PANEL and renders a `prediction-gauge` block. It clones the IO contract of
 * `simulate-runner.ts` exactly — the injectable `deps.flash` zero-network seam, the
 * deterministic `__subject_kind` marker resolution lifted to a SHARED exported helper,
 * the `resolveTier` Directional defense-in-depth throw, and the `.strict()` validate-
 * on-assemble — but swaps the binary stop/scroll leaf for the analyst-reasoning leaf:
 *   - `runPredictPanel`  (NOT the binary stop/scroll text leaf) — the analyst panel
 *     reasons about a scenario's LIKELIHOOD, each emitting a graded `lean` + ONE factor;
 *   - `aggregatePredict` (NOT the binary band/fraction collapse) — collapses the panel into the
 *     band / range / confidence / factors that the block carries verbatim (D-01: the
 *     `range` is panel-derived, never re-rolled, never a model field).
 *
 * Honesty spine (PRED-03 / D-04): every assembled block ALWAYS carries
 * `tier:"Directional"`, `model:"sim1-flash"`, and a non-empty always-on Directional
 * caveat — it is never an oracle. `successCriterion` is the audience's lens line; the
 * `assumptions` are the scenario's stated premises (derived purely from the scenario
 * text — no fabricated signal). The block is re-validated against the bands-only
 * `.strict()` `PredictionGaugeBlockSchema` before return (a smuggled point-score throws).
 *
 * D-03 / Pitfall 3: `readSubjectKind` is EXPORTED so the route (06-06) can reject a
 * person SIM at 400 BEFORE the runner runs. It rejects ONLY on an EXPLICIT
 * `note:"person"` marker — a marker-absent `mode:"general"` audience (the default
 * `template-analyst` Analyst Panel with `custom_context: []`) defaults to "panel" and
 * is NEVER mis-classified as a person (the landmine that would wrongly reject the
 * default panel). subjectKind is NEVER inferred from persona count.
 *
 * D-07 / D-08: the scenario is the CONTENT the analyst panel reasons about (structurally
 * data, fed to `runPredictPanel` as the reason target, data-fenced there) — never
 * concatenated into the steer. The steer rides the audience repaint (the analyst roster),
 * not the scenario.
 */

import { runPredictPanel } from "@/lib/engine/flash/run-predict-panel";
import type { PredictPanel } from "@/lib/engine/flash/run-predict-panel";
import { aggregatePredict } from "@/lib/engine/flash/predict-aggregate";
import { buildAudienceRepaint } from "@/lib/engine/flash/build-reaction-panel";
import { resolveTier } from "@/lib/audience/resolve-tier";
import { PredictionGaugeBlockSchema } from "@/lib/tools/profile-blocks";
import type { PredictionGaugeBlock } from "@/lib/tools/profile-blocks";
import type { Audience } from "@/lib/audience/audience-types";
import type { Stimulus } from "@/lib/engine/stimulus/types";

// ─── The reserved subjectKind marker (persisted by Profile, mirrors simulate-runner) ─

/** The reserved `persona_evidence_link` key Profile uses to persist the subjectKind. */
const SUBJECT_KIND_MARKER = "__subject_kind";

type SubjectKind = "person" | "panel";

/**
 * The always-on Directional caveat (UI-SPEC Copywriting Contract, F-04). Product copy —
 * always present on every assembled block, never a tooltip (PRED-03 / D-04 honesty).
 */
const DIRECTIONAL_CAVEAT =
  "A reasoned forecast from an analyst panel — directional, not a guarantee. " +
  "The range is where the analysts landed, not a measured probability.";

// ─── IO contract + injectable deps ──────────────────────────────────────────────

export interface PredictRunInput {
  /** The resolved General analyst-panel SIM (RLS-scoped). Carries the marker. */
  audience: Audience;
  /** The business scenario, normalized to a Stimulus by the route. */
  stimulus: Stimulus;
  /**
   * Optional explicit override. When absent (the normal route path), subjectKind is read
   * DETERMINISTICALLY from the audience's reserved marker, else defaults to "panel".
   */
  subjectKind?: SubjectKind;
}

export interface PredictRunDeps {
  /** The analyst-panel leaf (injectable for zero-network tests; defaults to the real call). */
  flash?: typeof runPredictPanel;
}

// ─── subjectKind resolution — SHARED exported helper (D-03 / Pitfall 3) ───────────

/**
 * Resolve the subjectKind WITHOUT ever inferring from persona count, exported so the
 * route imports it for its 400 person-reject (D-03 / D-08):
 *   1. an explicit `explicit` argument wins (caller override),
 *   2. else the persisted `__subject_kind` custom_context marker note,
 *   3. else "panel" — the marker-absent default (NOT "person"; Pitfall 3, so the default
 *      `template-analyst` Analyst Panel with `custom_context: []` is never rejected).
 *
 * It returns "person" ONLY on an EXPLICIT `note:"person"` (or explicit override) — the
 * route rejects a person SIM, but the default panel always proceeds.
 */
export function readSubjectKind(audience: Audience, explicit?: SubjectKind): SubjectKind {
  if (explicit === "person" || explicit === "panel") return explicit;
  const marker = (audience.custom_context ?? []).find(
    (c) => c.persona_evidence_link === SUBJECT_KIND_MARKER,
  );
  if (marker?.note === "person" || marker?.note === "panel") return marker.note;
  return "panel";
}

// ─── Assumptions — the scenario's stated premises (derived, never fabricated) ─────

/**
 * Derive the scenario's stated premises from the scenario text itself (sentence split).
 * Pure — no model output, no fabricated signal: every assumption is a substring of the
 * scenario the panel reasoned about. An empty scenario yields no premises.
 */
function deriveAssumptions(scenario: string): string[] {
  return scenario
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Build the steered analyst panel (the steer rides the roster, not the scenario) ─

/**
 * Project the audience into the `PredictPanel` input: the analyst roster (archetypes),
 * the lens (`successCriterion`), and any user grounding notes (`customContext`) — all
 * UNTRUSTED authored fields the leaf data-fences (D-07). The reserved `__subject_kind`
 * marker note is excluded from the grounding notes (it is steering metadata, not context).
 */
function buildPredictPanelInput(audience: Audience): PredictPanel {
  const archetypes = (audience.personas ?? []).map((p) => p.archetype);
  const customContext = (audience.custom_context ?? [])
    .filter((c) => c.persona_evidence_link !== SUBJECT_KIND_MARKER)
    .map((c) => c.note)
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  return {
    archetypes,
    successCriterion: audience.success_criterion ?? null,
    customContext,
  };
}

// ─── runPredict — the Predict verb ──────────────────────────────────────────────

/**
 * Run a business scenario through a General analyst panel and emit a bands-only,
 * Directional `prediction-gauge` block.
 *
 * Pipeline (cloned from simulate-runner, binary leaf swapped for the analyst panel):
 *   1. tier guard — resolveTier(audience) must be Directional (defense-in-depth; the
 *      user-facing reject is the route's 400, D-08).
 *   2. buildAudienceRepaint(audience) → steer the panel (General/empty → no-op).
 *   3. runPredictPanel(scenario, panel, repaint) → graded leans + named factors.
 *   4. aggregatePredict(result.analysts) → { band, range, confidence, factors } (REUSE —
 *      never re-rolled, never fabricated; D-01 range is panel-derived).
 *   5. assemble the always-Directional gauge block + re-validate (.strict()).
 */
export async function runPredict(
  input: PredictRunInput,
  deps: PredictRunDeps = {},
): Promise<PredictionGaugeBlock> {
  const { audience, stimulus } = input;
  const flash = deps.flash ?? runPredictPanel;

  // Tier is Directional by rule for a General panel (resolveTier is the SSOT). Predict runs
  // only against General audiences, so a non-Directional resolution is a programming error.
  // The user-facing reject is the route's 400 (D-08) — this throw is defense-in-depth.
  const tier = resolveTier(audience);
  if (tier !== "Directional") {
    throw new Error("predict runs against General (Directional) panels only");
  }

  // (2) Steer the panel by the audience repaint (General/empty personas → no-op).
  const repaint = buildAudienceRepaint(audience);

  // (3) The scenario is the CONTENT the analysts reason about (data, not steering — D-07).
  const panel = buildPredictPanelInput(audience);
  const { result } = await flash(stimulus.content, panel, repaint);

  // (4) Panel collapse reused verbatim — never re-rolled (D-01 honesty spine).
  const { band, range, confidence, factors } = aggregatePredict(result.analysts);

  // (5) Assemble the always-Directional gauge block (PRED-01 / PRED-03).
  const block: PredictionGaugeBlock = {
    type: "prediction-gauge",
    props: {
      audienceName: audience.name,
      scenario: stimulus.content,
      band,
      range,
      confidence,
      factors,
      panel: result.analysts.map((a) => ({
        archetype: a.archetype,
        lean: a.lean,
        reasoning: a.reasoning,
      })),
      assumptions: deriveAssumptions(stimulus.content),
      successCriterion: audience.success_criterion ?? null,
      caveat: DIRECTIONAL_CAVEAT,
      model: "sim1-flash",
      tier: "Directional",
    },
  };
  return validate(block);
}

/** Re-validate the assembled block against the bands-only `.strict()` contract (throws). */
function validate(block: PredictionGaugeBlock): PredictionGaugeBlock {
  const parsed = PredictionGaugeBlockSchema.safeParse(block);
  if (!parsed.success) {
    throw new Error(`prediction-gauge block validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}
