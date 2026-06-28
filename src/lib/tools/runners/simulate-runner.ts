/**
 * simulate-runner.ts — Phase 5 Plan 05 Task 1 (SIMU-01/02).
 *
 * `runSimulate` is the Simulate verb: a drafted message runs through a General audience
 * on the EXISTING Flash engine and renders a `reaction-distribution` card. It LIFTS the
 * per-audience read from `two-audience-read.ts` (buildAudienceRepaint → runFlashTextMode →
 * aggregateFlash) and DROPS the 2-audience delta — one audience, one distribution.
 *
 * The honesty line is D-02 / Pitfall 2:
 *   - PERSON → a single honest read (the lead reactor's verdict + reasoning + quote).
 *     band/fraction are SUPPRESSED — a single human has no honest "7/10" distribution.
 *   - PANEL  → the distribution: band + fraction (from aggregateFlash, NEVER re-rolled) +
 *     clustered themes + the per-persona reaction drill.
 *
 * The person/panel branch is DETERMINISTIC. It reads the `subjectKind` that Profile (05-04)
 * PERSISTED on the audience's reserved `custom_context` marker
 *   { source:"user", persona_evidence_link:"__subject_kind", note:"person"|"panel" }
 * — it does NOT re-infer from persona count, so a person SIM that baked >1 persona cannot
 * mis-branch to "panel". Default-person is the honest-safe fallback ONLY when the marker is
 * absent.
 *
 * Honesty spine: bands-only (`.strict()` schema), `tier: "Directional"` by rule
 * (resolveTier on the General SIM), `aggregateFlash` band math reused verbatim.
 *
 * D-08 (Pitfall 5): the drafted message is the CONTENT the personas react to — it is
 * structurally data, fed to runFlashTextMode as the reaction target, never concatenated
 * into the steering/system prompt (the steer rides the audience repaint, not the message).
 * The behavioral core is NOT imported here — the behavioral prompt rides ONLY the Profile
 * READ; Simulate uses the unchanged Flash prompt.
 */

import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash } from "@/lib/engine/flash/flash-aggregate";
import { buildAudienceRepaint } from "@/lib/engine/flash/build-reaction-panel";
import { resolveTier } from "@/lib/audience/resolve-tier";
import { ReactionDistributionBlockSchema } from "@/lib/tools/profile-blocks";
import type { ReactionDistributionBlock } from "@/lib/tools/profile-blocks";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import type { Audience } from "@/lib/audience/audience-types";
import type { Stimulus } from "@/lib/engine/stimulus/types";

// ─── The reserved subjectKind marker (persisted by Profile, 05-04) ───────────────

/** The reserved `persona_evidence_link` key Profile uses to persist the subjectKind. */
const SUBJECT_KIND_MARKER = "__subject_kind";

type SubjectKind = "person" | "panel";

// ─── IO contract + injectable deps ──────────────────────────────────────────────

export interface SimulateRunInput {
  /** The resolved General SIM (RLS-scoped — never raw weights). Carries the marker. */
  audience: Audience;
  /** The drafted message, normalized to a Stimulus by the route. */
  stimulus: Stimulus;
  /**
   * Optional explicit override. When absent (the normal route path), subjectKind is read
   * DETERMINISTICALLY from the audience's reserved marker, else falls back to "person".
   */
  subjectKind?: SubjectKind;
}

export interface SimulateRunDeps {
  /** The Flash engine (injectable for zero-network tests; defaults to the real engine). */
  flash?: typeof runFlashTextMode;
}

// ─── subjectKind resolution (deterministic — D-02 / Pitfall 2) ───────────────────

/**
 * Resolve the subjectKind WITHOUT ever re-inferring from persona count:
 *   1. an explicit `input.subjectKind` wins (caller override),
 *   2. else the persisted `__subject_kind` custom_context marker note,
 *   3. else "person" (the honest-safe fallback — never a fabricated crowd).
 */
function resolveSubjectKind(audience: Audience, explicit?: SubjectKind): SubjectKind {
  if (explicit === "person" || explicit === "panel") return explicit;
  const marker = (audience.custom_context ?? []).find(
    (c) => c.persona_evidence_link === SUBJECT_KIND_MARKER,
  );
  if (marker?.note === "person" || marker?.note === "panel") return marker.note;
  return "person";
}

// ─── Person presentation — the lead reactor as a single honest read ──────────────

/**
 * Pick the lead Flash persona for the person read: the highest-share calibrated persona's
 * archetype matched against the Flash panel, falling back to the first Flash persona. The
 * 9 non-lead generic personas are discarded (a single human is ONE reactor, not a crowd).
 */
function pickLeadPersona(audience: Audience, personas: FlashPersona[]): FlashPersona | null {
  if (personas.length === 0) return null;
  const lead = [...(audience.personas ?? [])].sort((a, b) => b.share - a.share)[0];
  if (lead) {
    const match = personas.find((p) => p.archetype === lead.archetype);
    if (match) return match;
  }
  return personas[0]!;
}

/** Humanized verdict word for the person read (the deterministic stop/scroll, in plain language). */
function humanVerdict(verdict: FlashPersona["verdict"]): string {
  return verdict === "stop" ? "receptive" : "resistant";
}

/** A grounded reasoning line derived from the deterministic verdict (no fabricated signal). */
function reasoningFor(verdict: FlashPersona["verdict"]): string {
  return verdict === "stop"
    ? "The message lands — they engage with it rather than scroll past."
    : "The message doesn't land — they pass over it rather than stop to engage.";
}

// ─── Panel presentation — clustered themes from the reaction-frame split ──────────

/**
 * Cluster the panel reactions into themes by their reaction frame (stop vs scroll), one
 * representative quote each. Honest grouping — no fabricated buckets, only the frames the
 * panel actually produced.
 */
function clusterThemes(personas: FlashPersona[]): { label: string; quote: string }[] {
  const themes: { label: string; quote: string }[] = [];
  const stopped = personas.filter((p) => p.verdict === "stop");
  const scrolled = personas.filter((p) => p.verdict === "scroll");
  if (stopped.length > 0) {
    themes.push({ label: `Stopped to engage (${stopped.length})`, quote: stopped[0]!.quote });
  }
  if (scrolled.length > 0) {
    themes.push({ label: `Scrolled past (${scrolled.length})`, quote: scrolled[0]!.quote });
  }
  return themes;
}

// ─── runSimulate — the Simulate verb ──────────────────────────────────────────────

/**
 * Run a drafted message through a General audience on the existing Flash engine and emit
 * a person/panel-aware, bands-only, Directional `reaction-distribution` block.
 *
 * Pipeline (lifted from two-audience-read's per-audience read, delta dropped):
 *   1. resolve subjectKind deterministically (marker, never persona count).
 *   2. buildAudienceRepaint(audience) → steer the panel (General/empty → no-op).
 *   3. runFlashTextMode(message, "idea", {niche:null,contentType:null}, repaint).
 *   4. aggregateFlash(personas) → { band, fraction } (REUSE — never re-roll).
 *   5. branch: person → single lead read (band/fraction suppressed); panel → distribution.
 */
export async function runSimulate(
  input: SimulateRunInput,
  deps: SimulateRunDeps = {},
): Promise<ReactionDistributionBlock> {
  const { audience, stimulus } = input;
  const flash = deps.flash ?? runFlashTextMode;

  const subjectKind = resolveSubjectKind(audience, input.subjectKind);

  // Tier is Directional by rule for a General SIM (resolveTier is the SSOT). Simulate runs
  // only against General audiences, so a non-Directional resolution is a programming error.
  const tier = resolveTier(audience);
  if (tier !== "Directional") {
    throw new Error("simulate runs against General (Directional) audiences only");
  }

  // (2) Steer the panel by the audience repaint (General/empty personas → byte-identical
  //     Flash no-op — the moat-credibility projection, shared with the video fold).
  const repaint = buildAudienceRepaint(audience);

  // (3) The drafted message is the CONTENT the personas react to (data, not steering — D-08).
  const panel = { niche: null, contentType: null } as const;
  const { result } = await flash(stimulus.content, "idea", panel, repaint);

  // (4) Band math reused verbatim — never re-rolled (honesty spine).
  const { band, fraction } = aggregateFlash(result.personas);

  if (subjectKind === "person") {
    // PERSON → a single honest read; NO crowd (Pitfall 2 — band/fraction suppressed).
    const lead = pickLeadPersona(audience, result.personas);
    const block: ReactionDistributionBlock = {
      type: "reaction-distribution",
      props: {
        audienceName: audience.name,
        subjectKind: "person",
        read: lead
          ? {
              verdict: humanVerdict(lead.verdict),
              reasoning: reasoningFor(lead.verdict),
              quote: lead.quote,
            }
          : null,
        model: "sim1-flash",
        tier: "Directional",
      },
    };
    return validate(block);
  }

  // PANEL → the distribution: band + fraction + clustered themes + per-persona drill.
  const block: ReactionDistributionBlock = {
    type: "reaction-distribution",
    props: {
      audienceName: audience.name,
      subjectKind: "panel",
      band,
      fraction,
      themes: clusterThemes(result.personas),
      reactions: result.personas.map((p) => ({
        archetype: p.archetype,
        verdict: p.verdict,
        quote: p.quote,
      })),
      model: "sim1-flash",
      tier: "Directional",
    },
  };
  return validate(block);
}

/** Re-validate the assembled block against the bands-only `.strict()` contract. */
function validate(block: ReactionDistributionBlock): ReactionDistributionBlock {
  const parsed = ReactionDistributionBlockSchema.safeParse(block);
  if (!parsed.success) {
    throw new Error(`reaction-distribution block validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}
