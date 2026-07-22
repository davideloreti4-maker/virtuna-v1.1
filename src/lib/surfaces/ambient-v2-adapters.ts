/**
 * Ambient Audience v2 — surface adapters (Phase B of the wiring milestone).
 *
 * Pure functions: real app state → the three v2 surface view-models (`StartData` / `SimulateData` /
 * `OverviewData`). NO fabrication — every field is REAL (from the audience / the projection) or
 * STATIC config (the behavioral funnel · intake doors · skill menu). The sim-fired MEASURED verdicts
 * (`watching.verdictPct`, `ranked.stopPct`) arrive as the OPTIONAL `watching` / `measured` inputs;
 * absent ⇒ an honest `queued` row with its would-stop % withheld (`0`) — the sealed-verdict design
 * law: a projection is never dressed as a measurement it didn't run.
 *
 * The data-fetch layer maps the real `Audience` / user profile / thread descriptors → the clean
 * inputs below, so this module stays pure + unit-testable (no DB, no time, no randomness).
 *
 * Build spec + provenance audit: docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md
 */

import type {
  CastMember,
  OverviewData,
  RankKind,
  RankedStimulus,
  SimTier,
  WatchingRun,
} from "@/components/audience-lens/v2/AmbientOverview";
import type {
  DevelopContext,
  IntakeOption,
  SimLens,
  SimulateData,
  StimulusKind,
} from "@/components/audience-lens/v2/AmbientSimulate";
import type { SkillGroup, StartData } from "@/components/audience-lens/v2/AmbientStart";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

// ── the real audience facts every surface reads ────────────────────────────────

/** The calibrated audience, projected to exactly what the three surfaces display. The mount layer
 *  maps a live `Audience` (name · calibration · tier · signature segments) → this. */
export interface AudienceMeta {
  name: string; // "Your audience"
  /** Overview's `provenance` — the calibration recency badge ("calibrated · 3d"). */
  calibrationBadge: string;
  /** Simulate's `provenance` — what the audience was calibrated FROM (the source platform). */
  calibratedFrom: string;
  tier: SimTier; // resolveTier → flash | max
  scene: string; // how they ENCOUNTER the stimulus (the current platform choice)
  sceneOptions: string[];
  /** The signature's named slices (each `share` is 0..1 of the room). Drives Simulate's segment
   *  picker + Overview's on-call cast. */
  segments: { label: string; share: number }[];
}

const TIER_LABEL: Record<SimTier, string> = { flash: "SIM-1 Flash", max: "SIM-1 Max" };
const FIDELITY_OPTIONS = ["SIM-1 Flash", "SIM-1 Max"];
const CAST_SHOWN = 4;

// ── shared honesty helpers ─────────────────────────────────────────────────────

/** Parse the projection fraction ("8/10 stop") → the 0–10 persona-stop count. Missing/malformed → 0
 *  (Weak = last), mirroring the runner's `coercePersonaStops`. */
export function parsePersonaStops(fraction: string): number {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(fraction ?? "");
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

const RANK_KINDS: ReadonlySet<string> = new Set([
  "hook",
  "idea",
  "video",
  "script",
  "remix",
  "concept",
]);

/** Map a descriptor's kind id → the Overview `RankKind`; unknown/absent ⇒ "concept". */
export function rankKindOf(kind?: string): RankKind {
  return (kind && RANK_KINDS.has(kind) ? kind : "concept") as RankKind;
}

// ── ① Overview ─────────────────────────────────────────────────────────────────

export interface OverviewInput {
  audience: AudienceMeta;
  /** The thread's projected cards (the ledger) — each carries its own personaStops via `fraction`. */
  descriptors: AmbientCardDescriptor[];
  /** Measured would-stop % per descriptor id, from FIRED sims (sealed). An id present here ⇒ that
   *  row is `simulated`; absent ⇒ `queued` (withheld % = 0). */
  measured?: Record<string, number>;
  /** A sim in flight — sealed until n-of-n decide (`verdictPct` revealed only then). */
  watching?: WatchingRun | null;
}

/** Build the Overview view-model. Ranked order: sealed rows first (by measured stopPct desc), then
 *  queued rows (by personaStops desc) — so a run always outranks a projection, and the top is the
 *  win. Stable tie-break on generation order (the descriptor sequence). */
export function buildOverviewData({
  audience,
  descriptors,
  measured,
  watching,
}: OverviewInput): OverviewData {
  const ranked: RankedStimulus[] = descriptors.map((d) => {
    const m = measured?.[d.id];
    const sealed = typeof m === "number";
    return {
      id: d.id,
      stimulus: d.conceptText,
      stopPct: sealed ? m : 0,
      personaStops: parsePersonaStops(d.fraction),
      kind: rankKindOf(d.kind),
      state: sealed ? "simulated" : "queued",
    };
  });

  ranked.sort((a, b) => {
    const aSealed = a.state === "simulated";
    const bSealed = b.state === "simulated";
    if (aSealed !== bSealed) return aSealed ? -1 : 1;
    if (aSealed) return b.stopPct - a.stopPct;
    return (b.personaStops ?? 0) - (a.personaStops ?? 0);
  });

  return {
    audienceName: audience.name,
    provenance: audience.calibrationBadge,
    tier: audience.tier,
    watching: watching ?? null,
    ranked,
    cast: deriveCast(audience),
    castOverflow: Math.max(0, audience.segments.length - CAST_SHOWN),
  };
}

/** On-call avatars — initials of the calibrated room's named slices (real segments, never invented). */
function deriveCast(audience: AudienceMeta): CastMember[] {
  return audience.segments.slice(0, CAST_SHOWN).map((s, i) => ({
    id: s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `seg-${i}`,
    initial: (s.label.trim()[0] ?? "•").toUpperCase(),
  }));
}

// ── ⑤ Simulate ─────────────────────────────────────────────────────────────────

export interface SimulateInput {
  audience: AudienceMeta;
  stimulus: { text: string; kind: StimulusKind };
  /** The rank this run deepens (a `develop` entry). Omit for a `cold` entry from the ④ door. */
  develop?: DevelopContext;
}

/** Build the Simulate (arming) view-model. Lenses + intake doors are STATIC config; segments are the
 *  real signature slices prefixed with the whole-room default. */
export function buildSimulateData({ audience, stimulus, develop }: SimulateInput): SimulateData {
  return {
    stimulus,
    room: audience.name,
    provenance: audience.calibratedFrom,
    scene: audience.scene,
    fidelity: audience.tier,
    lenses: BEHAVIORAL_LENSES,
    defaultLens: 0,
    segments: [{ label: "Everyone", share: 1 }, ...audience.segments],
    develop,
    intake: INTAKE_DOORS,
  };
}

// ── ④ Start ──────────────────────────────────────────────────────────────────────

export interface StartInput {
  name: string; // the creator's first name (profile)
  audience: AudienceMeta;
}

/** Build the Start (instrument-at-rest) view-model. Conditions are the real audience/scene/tier;
 *  the skill menu is STATIC config keyed to real skill ids. */
export function buildStartData({ name, audience }: StartInput): StartData {
  return {
    name,
    conditions: {
      audience: audience.name,
      scene: audience.scene,
      sceneOptions: audience.sceneOptions,
      fidelity: TIER_LABEL[audience.tier],
      fidelityOptions: FIDELITY_OPTIONS,
    },
    skillGroups: START_SKILL_GROUPS,
    composerPlaceholder: "…or just ask",
  };
}

// ── static config (real UI contract, not fabricated data) ──────────────────────

/** The behavioral funnel — each lens is a decision the room makes, in funnel order (owner call
 *  2026-07-21: observable ACTIONS, not internal states). The Brain tab decomposes want/believe/feel;
 *  the population only reads what it can DO. */
export const BEHAVIORAL_LENSES: SimLens[] = [
  { key: "stop", label: "Stop", gloss: "stop scrolling", stage: "Attention — the thumb-stop in the first 2 seconds" },
  { key: "finish", label: "Finish", gloss: "watch it through", stage: "Retention — do they stay to the end" },
  { key: "share", label: "Share", gloss: "send it to someone", stage: "Spread — worth passing on" },
  { key: "follow", label: "Follow", gloss: "follow you", stage: "Growth — worth coming back for" },
  { key: "buy", label: "Buy", gloss: "act on the CTA", stage: "Conversion — click, buy, or sign up" },
];

/** The cold-start intake doors. SCREEN is live; COMPARE (A/B) + QUERY (ask/survey) are deferred
 *  ("soon") — they need their own read-templates (the per-domain-bundle work). */
export const INTAKE_DOORS: IntakeOption[] = [
  { kind: "video", label: "Test a real video", sub: "upload or paste a link — the full read", family: "screen", status: "active", stimulusKind: "video" },
  { kind: "draft", label: "Screen a draft", sub: "a hook, script, or caption you're weighing", family: "screen", status: "active", stimulusKind: "draft" },
  { kind: "ab", label: "Compare two (A/B)", sub: "run both variants, see who wins", family: "compare", status: "soon" },
  { kind: "ask", label: "Ask the room", sub: "put a question to your audience", family: "query", status: "soon" },
  { kind: "survey", label: "Run a survey", sub: "structured answers across the room", family: "query", status: "soon" },
];

/** Every skill the platform offers, grouped by verb. `id`s are the real SKILL_RUN_META keys; `lens`
 *  + `icon` are authored presentation. (A drift guard against SKILL_TOOLS is a cheap follow-up.) */
export const START_SKILL_GROUPS: SkillGroup[] = [
  {
    label: "Make",
    skills: [
      { id: "hooks", label: "Hooks", lens: "Would they stop?", icon: "sparkle" },
      { id: "ideas", label: "Ideas", lens: "Would they want it?", icon: "idea" },
      { id: "script", label: "Script", lens: "Would they finish?", icon: "pen" },
      { id: "remix", label: "Remix", lens: "Would it travel?", icon: "repeat" },
    ],
  },
  {
    label: "Analyze",
    skills: [
      { id: "test", label: "Test", lens: "Frame-by-frame read", icon: "target" },
      { id: "read", label: "Read", lens: "Would it land?", icon: "doc" },
      { id: "account", label: "Account", lens: "What's working", icon: "list" },
    ],
  },
  {
    label: "Discover",
    skills: [{ id: "explore", label: "Explore", lens: "What's breaking out", icon: "search" }],
  },
];
