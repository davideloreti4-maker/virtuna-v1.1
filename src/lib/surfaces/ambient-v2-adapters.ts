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
  RoomSegment,
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
   *  picker + Overview's on-call cast. `archetype` is the ENGINE key the projection is read by;
   *  `label` is creator-editable display text and must never be used to identify a slice. */
  segments: { archetype: string; label: string; share: number }[];
}

const TIER_LABEL: Record<SimTier, string> = { flash: "SIM-1 Flash", max: "SIM-1 Max" };
const FIDELITY_OPTIONS = ["SIM-1 Flash", "SIM-1 Max"];

// ── shared honesty helpers ─────────────────────────────────────────────────────

/**
 * THE 0/10 RANK IS DEAD (owner call, 2026-08-02).
 *
 * `parsePersonaStops` lived here and turned a descriptor's `fraction` ("8/10 stop") into the
 * number the board printed beside every un-run row, bar and all. The persona SIM that once
 * produced that fraction is GONE from the generation path — what survives is the generating
 * model's own SELF-ESTIMATE (see the `bandFromStops` call sites in the hooks / ideas / script /
 * remix runners), so the board was ranking, bar-charting and ordering un-run work by a number
 * the engine no longer measures. A queued row now carries no score and no bar at all.
 *
 * ⚠️ The PRODUCERS are untouched on purpose: `fraction` / `band` / `personaStops` still exist in
 * the runner schemas and the routes still parse them. This is a rendering decision. Deleting a
 * field the routes read is a different, larger change with no design ask behind it.
 */

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

/** A tested video surfaced in the Overview — sourced from a `threads.sim_seals` entry carrying a
 *  `video` blob. It carries a NATIVE viral score (craft, shown always) AND an attention `stopPct`
 *  (already measured at Test time) that stays WITHHELD until the row is `revealed` — clicking
 *  Simulate reveals it (no re-run: the analysis already produced it). */
export interface OverviewVideoRow {
  id: string; // the seal key (analysisId) — stable across reload
  label: string; // the row's stimulus text (the video's concept/title)
  viralScore?: number | null; // 0–100 native craft score (never the attention %)
  stopPct: number; // 0–100 attention %, from the sealed brain read — shown only once revealed
  revealed: boolean; // true once the user clicked Simulate this session
}

export interface OverviewInput {
  audience: AudienceMeta;
  /** The thread's projected cards (the ledger) — each carries its own personaStops via `fraction`. */
  descriptors: AmbientCardDescriptor[];
  /** Measured would-stop % per descriptor id, from FIRED sims (sealed). An id present here ⇒ that
   *  row is `simulated`; absent ⇒ `queued` (withheld % = 0). */
  measured?: Record<string, number>;
  /** For ids whose measured % is ONE SLICE's rather than the room's: that slice's display name.
   *  Travels beside `measured` because the number alone cannot say what it is a percentage OF. */
  measuredSlice?: Record<string, string>;
  /** Ids whose sealed run produced NO population ⇒ no depth drill exists behind the row. Travels
   *  separately from `measured` because a row can hold a perfectly real % and still have nothing
   *  behind it: the % comes from the flash reaction, the depth from the population projection, and
   *  the two fail independently. Only consulted for sealed rows — a queued row has no depth yet by
   *  definition, and is already labelled as such. */
  depthless?: Record<string, boolean>;
  /** Tested videos from the seal store — ranked in alongside the concepts (see `OverviewVideoRow`). */
  videos?: OverviewVideoRow[];
  /** A sim in flight — sealed until n-of-n decide (`verdictPct` revealed only then). */
  watching?: WatchingRun | null;
}

/** Build the Overview view-model. Ranked order: sealed rows first (by measured stopPct desc), then
 *  queued rows in LEDGER ORDER — the descriptor sequence, then the video sequence, exactly as they
 *  were generated. A run always outranks a projection, and the top of the board is the win.
 *
 *  Queued rows used to sort by `queuedRankKey` (personaStops, or a video's viral score scaled onto
 *  the same 0–10 axis). With the 0/10 rank dead there is no measured signal left to order un-run
 *  work by, and inventing one — recency dressed as quality, a craft score standing in for
 *  attention — would be the same fabrication in the SORT that the row itself just stopped
 *  printing. Ledger order claims only what is true: this is the order you made them in. */
export function buildOverviewData({
  audience,
  descriptors,
  measured,
  measuredSlice,
  depthless,
  videos,
  watching,
}: OverviewInput): OverviewData {
  const conceptRows: RankedStimulus[] = descriptors.map((d) => {
    const m = measured?.[d.id];
    const sealed = typeof m === "number";
    // The slice label rides ONLY on a sealed row: an unsealed row has no measured number for it
    // to qualify, and labelling a projection with a slice it was never run against is the bug
    // this field exists to prevent.
    const sliceLabel = sealed ? measuredSlice?.[d.id] : undefined;
    // Same rule as the slice label, same reason: only a SEALED row can be known to have no depth.
    const noDepth = sealed && depthless?.[d.id] === true;
    return {
      id: d.id,
      stimulus: d.conceptText,
      stopPct: sealed ? m : 0,
      kind: rankKindOf(d.kind),
      state: sealed ? "simulated" : "queued",
      ...(sliceLabel ? { sliceLabel } : {}),
      ...(noDepth ? { noDepth: true } : {}),
    };
  });

  const videoRows: RankedStimulus[] = (videos ?? []).map((v) => ({
    id: v.id,
    stimulus: v.label,
    stopPct: v.revealed ? v.stopPct : 0,
    viralScore: v.viralScore ?? null,
    kind: "video",
    state: v.revealed ? "simulated" : "queued",
  }));

  const ranked: RankedStimulus[] = [...conceptRows, ...videoRows];

  ranked.sort((a, b) => {
    const aSealed = a.state === "simulated";
    const bSealed = b.state === "simulated";
    if (aSealed !== bSealed) return aSealed ? -1 : 1;
    if (aSealed) return b.stopPct - a.stopPct;
    // Queued: hold the input order. `Array#sort` is stable (spec-required since ES2019), so
    // returning 0 IS the ledger order — concepts in descriptor sequence, then the videos.
    return 0;
  });

  return {
    audienceName: audience.name,
    provenance: audience.calibrationBadge,
    // The room's header states its own facts now (N minds · calibration · where they read), so the
    // SCENE has to reach the Overview instead of stopping at Simulate. It is the same chosen scene
    // ⑤ arms a run with — one fact, one source.
    scene: audience.scene,
    tier: audience.tier,
    watching: watching ?? null,
    ranked,
    segments: deriveSegments(audience),
  };
}

/**
 * The room's makeup, biggest slice first — what the RESTING board states in place of an empty
 * ranked list (2026-08-11 r3: the rail mounts on the desktop arrival, where no work exists yet).
 *
 * This replaced `deriveCast`, which returned initials for an avatar cluster that had rendered
 * nowhere since rev B+ and was parked as an open question. The answer is: the cast comes back with
 * NAMES and SHARES. Initials were tried in the audience sheet on 2026-08-11 and cut the same day —
 * they carry no information and collide ("General" and "Growth Audience" both render a grey "G").
 *
 * Percentages are apportioned by LARGEST REMAINDER, not rounded independently: independent rounding
 * of 4–8 shares lands the column on 98–102, and a column of real numbers that doesn't add up is
 * exactly what makes a real number look fabricated. The target is `round(sum)`, NOT a hardcoded
 * 100 — if a signature's shares genuinely sum to 0.98, this prints 98 rather than inventing the
 * missing two points.
 */
function deriveSegments(audience: AudienceMeta): RoomSegment[] {
  const rows = [...audience.segments]
    .sort((a, b) => b.share - a.share)
    .map((s) => {
      const exact = s.share * 100;
      const floor = Math.floor(exact);
      return { archetype: s.archetype, label: s.label, sharePct: floor, frac: exact - floor };
    });
  const target = Math.round(audience.segments.reduce((sum, s) => sum + s.share * 100, 0));
  let left = Math.max(0, target - rows.reduce((sum, r) => sum + r.sharePct, 0));
  // Hand the leftover points to the largest fractional parts first — the standard apportionment.
  for (const row of [...rows].sort((a, b) => b.frac - a.frac)) {
    if (left <= 0) break;
    row.sharePct += 1;
    left -= 1;
  }
  return rows.map(({ archetype, label, sharePct }) => ({ archetype, label, sharePct }));
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
    sceneOptions: audience.sceneOptions,
    fidelity: audience.tier,
    lenses: BEHAVIORAL_LENSES,
    defaultLens: 0,
    // "Everyone" carries NO archetype — that absence is what marks the whole-room run, and it is
    // what the route reads to decide between the room's verdict and a slice's.
    segments: [{ archetype: null, label: "Everyone", share: 1 }, ...audience.segments],
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
/**
 * `stage` used to lead with the funnel's own vocabulary ("Attention — the thumb-stop in the first
 * 2 seconds", "Retention — …", "Conversion — …") and rendered on its own second line under the
 * question. Rev B+ folds it into ONE line — "Would they stop scrolling? — the first 2 seconds" —
 * so the stage keeps only the half that tells a creator something they didn't already read in the
 * question above it. The funnel words were naming our model, not their video.
 */
export const BEHAVIORAL_LENSES: SimLens[] = [
  { key: "stop", label: "Stop", gloss: "stop scrolling", stage: "the first 2 seconds" },
  { key: "finish", label: "Finish", gloss: "watch it through", stage: "do they stay to the end" },
  { key: "share", label: "Share", gloss: "send it to someone", stage: "worth passing on" },
  { key: "follow", label: "Follow", gloss: "follow you", stage: "worth coming back for" },
  { key: "buy", label: "Buy", gloss: "act on the CTA", stage: "click, buy, or sign up" },
];

/** The cold-start intake doors. SCREEN is live; COMPARE (A/B) + QUERY (ask/survey) are deferred
 *  ("soon") — they need their own read-templates (the per-domain-bundle work). */
export const INTAKE_DOORS: IntakeOption[] = [
  { kind: "video", label: "Test a real video", sub: "Upload or paste a link — the full read", family: "screen", status: "active", stimulusKind: "video" },
  { kind: "draft", label: "Screen a draft", sub: "A hook, script, or caption you're weighing", family: "screen", status: "active", stimulusKind: "draft" },
  // "Compare two (A/B)" — the parenthetical was the only place in the product that made a creator
  // read a piece of our jargon to understand a door. The sub-line already says what it does.
  { kind: "ab", label: "Compare two", sub: "Run both versions, see who wins", family: "compare", status: "soon" },
  { kind: "ask", label: "Ask the room", sub: "Put a question to your audience", family: "query", status: "soon" },
  { kind: "survey", label: "Run a survey", sub: "Structured answers across the room", family: "query", status: "soon" },
];

/**
 * Every artifact the platform offers, grouped by WHAT YOU CAME TO DO (Create · Research) rather
 * than by verb (the old Make/Analyze/Discover). The verb axis made every new capability its own
 * tile — it grows as `verbs × artifacts` and explodes the moment the product goes horizontal. The
 * artifact axis grows one tile per artifact and lets the verbs ride the sentence (chat-agent-loop
 * already routes "test this" / "give me ideas" from natural language).
 *
 * `id`s are composer **ToolIds** (the SKILLS registry in `composer-controls.tsx`) — this line read
 * "the real SKILL_RUN_META keys" until 2026-07-27, and the grid believed it: SKILL_RUN_META is a
 * separate display namespace that spells Ideas `ideas`, so the tile armed a tool no branch matched
 * and fell through to the paid video Test (F-017). `label` + `lens` + `icon` are authored
 * presentation. Each `lens` says what you GET BACK, in the fewest plain words that survive a glance
 * — a label alone cannot disambiguate "Test" from "Read", but "Frame by frame, and the one fix" vs
 * "Run a draft past your audience" can. The drift guard now exists: start-registry-drift.test.ts.
 */
export const START_SKILL_GROUPS: SkillGroup[] = [
  {
    // 2 tracks, 2 inner columns — Create carries ~2× Research's artifacts, so it gets 2× the width
    // and both sides bottom out level.
    // CREATE / RESEARCH, not Content / Intel (2026-08-02). The old pair named the OUTPUT CLASS —
    // which is the shelf a librarian wants, not the verb a creator arrives with — and "Intel" was
    // the last piece of operator-speak on the surface.
    label: "Create",
    span: 2,
    skills: [
      // `idea`, SINGULAR — these ids are consumed as composer ToolIds (onSkill → pickStartSkill,
      // and the armed-tile highlight compares against activeTool). `ideas` is the SKILL_RUN_META
      // display key, a DIFFERENT namespace; using it here armed a tool no branch matched, and
      // handleSubmit's final else is the paid video Test — so the Ideas tile ran a SIM-1 Max
      // video Test off a pasted URL (F-017). The two namespaces differ in exactly this one id.
      // Each `lens` says what you GET BACK. These two said what the thing IS ("Concepts worth
      // making" / "A full short-form script") — which the label already said — so they were the
      // two tiles a creator learned nothing from.
      { id: "idea", label: "Ideas", lens: "Ranked before you film", icon: "bulb" },
      { id: "hooks", label: "Hooks", lens: "Openers that stop them", icon: "firstline" },
      { id: "script", label: "Script", lens: "Written to hold attention", icon: "page" },
      { id: "remix", label: "Remix", lens: "Rebuild what worked", icon: "repeat" },
      { id: "test", label: "Video test", lens: "Frame by frame, one fix", icon: "filmstrip" },
      // Named, not wired: there is no `ad` runner in SKILL_TOOLS / SKILL_RUN_META yet, so the tile
      // is inert. Ad creative is a short video with money attached — it inherits the whole frame
      // stack AND the Socials calibration anchor, which is why it's the first business artifact.
      { id: "ad", label: "Ad creative", lens: "Test before you spend", icon: "mega", status: "soon" },
    ],
  },
  {
    label: "Research",
    skills: [
      { id: "explore", label: "Explore", lens: "What's breaking out", icon: "compass" },
      { id: "account", label: "Account teardown", lens: "Yours, or a rival's", icon: "at" },
      // Compare is INTEL, not Content: it produces a verdict about two things that already exist,
      // it does not produce a new artifact. No runner yet — inert until one exists.
      { id: "compare", label: "Compare A/B", lens: "Two versions, one winner", icon: "ab", status: "soon" },
    ],
  },
];
