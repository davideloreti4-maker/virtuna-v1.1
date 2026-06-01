import type { PersonaSlotType, PersonaWeights } from './audience-types';

/** D-06 cell fill wave timing — 180ms total per row, 18ms stagger between cells (10 cells default). */
export const CELL_FILL_WAVE_MS = 180;
export const CELL_FILL_STAGGER_MS = 18;

/** D-07 curve animation timing. */
export const CURVE_BASELINE_MS = 300;
export const CURVE_MORPH_MS = 800;

/** D-12 cluster collapse thresholds in canvas px. */
export const MARKER_CLUSTER_PX_LARGE = 12;  // ≥3 markers within this radius → cluster
export const MARKER_CLUSTER_PX_SMALL = 6;   // ≥2 markers within this radius → cluster
export const MARKER_HIT_RADIUS = 22;        // tap target hit radius
export const MARKER_DOT_RADIUS = 4;         // visual radius (8px diameter per D-11)

/** UI-SPEC filmstrip keyframe fade-in. */
export const FILMSTRIP_KEYFRAME_FADE_MS = 150;

/** Perf-tier degradation (RESEARCH §Perf-tier degradation specifics). */
export const MEDIUM_TIER_WAVE_FACTOR = 0.5;  // halve wave to 90ms on medium tier

/** TITLE_BAR_HEIGHT carried from board-constants (re-exported for audience-node frame math). */
export const AUDIENCE_FRAME_TITLE_BAR_H = 36;

/** D-18 "matches preset" epsilon. */
export const WEIGHT_PRESET_EPSILON = 0.005;

/** D-05 fixed archetype slot order — skeleton rows pre-render in this sequence. */
export const PERSONA_SLOT_ORDER: ReadonlyArray<PersonaSlotType> = [
  'fyp', 'fyp', 'fyp', 'fyp', 'fyp', 'fyp',
  'niche', 'niche',
  'loyalist',
  'cross_niche',
] as const;

/** D-18 weight preset values. */
export const WEIGHT_PRESETS: Record<'default' | 'established' | 'niche_heavy' | 'new_creator', PersonaWeights> = {
  default:     { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
  established: { fyp: 0.40, niche: 0.20, loyalist: 0.30, cross_niche: 0.10 },
  niche_heavy: { fyp: 0.30, niche: 0.55, loyalist: 0.10, cross_niche: 0.05 },
  new_creator: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
} as const;

/** Display names for individual archetypes (from engine persona-registry). */
export const ARCHETYPE_DISPLAY_NAME: Record<string, string> = {
  high_engager:          'High Engager',
  saver:                 'Saver',
  lurker:                'Lurker',
  sharer:                'Sharer',
  tough_crowd:           'Tough Crowd',
  purposeful_viewer:     'Purposeful',
  niche_deep_buyer:      'Niche Buyer',
  niche_deep_scout:      'Niche Scout',
  loyalist:              'Loyalist',
  cross_niche_curiosity: 'Cross-Niche',
  // legacy aliases from older Pass2PersonaResult shape
  viewer:                'Viewer',
  niche_deep:            'Niche Deep',
};

/** Always-on persona insight: a one-line plain-language finding from the
 *  per-persona drop times, so the key audience takeaway is visible without
 *  opening a row. "Most viewers hold to ~Ns" + the earliest-dropping persona
 *  when it's a clear outlier (>4s before the median). */
export function derivePersonaInsight(
  personas: ReadonlyArray<{ id: string; archetype?: string; swipe_predicted_at: number | null }>,
): string | null {
  if (!personas.length) return null;
  const drops = personas
    .map((p) => p.swipe_predicted_at)
    .filter((t): t is number => t != null);
  if (drops.length === 0) return 'All personas watch to the end';

  const sorted = [...drops].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const earliestT = sorted[0]!;
  const earliestP = personas.find((p) => p.swipe_predicted_at === earliestT);
  const name = earliestP
    ? ARCHETYPE_DISPLAY_NAME[earliestP.archetype ?? ''] ?? earliestP.archetype ?? earliestP.id
    : null;

  const base = `Most viewers hold to ~${Math.round(median)}s`;
  return name && earliestT < median - 4
    ? `${base} · ${name} drops first at ${Math.round(earliestT)}s`
    : base;
}

/** D-11 marker ring colors by archetype slot. */
export const MARKER_RING_COLOR: Record<PersonaSlotType, string> = {
  fyp:         '#FF7F50',                  // coral-500
  niche:       'oklch(0.87 0.10 40)',      // coral-300
  loyalist:    'oklch(0.97 0.03 40)',      // coral-100
  cross_niche: 'rgba(255,255,255,0.30)',
} as const;
