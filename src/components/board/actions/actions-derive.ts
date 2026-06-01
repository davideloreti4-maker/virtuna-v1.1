// Pure view-model derivation for the action-led Actions frame.
// No React, no IO — keeps the routing logic testable and ActionsNode thin.
//
// The frame owns ONE thing: what to do. The band drives the hero:
//   high  → ship-led: when-to-post is the hero, fixes demote to optional polish
//   low   → fix-led (critical tone)
//   mid   → fix-led (softer tone)
//   none  → degraded: top-level advice rows, or "all set"
import type {
  CounterfactualResult,
  CounterfactualSuggestionItem,
  Suggestion,
} from '@/lib/engine/types';
import { ACTIONS_COPY } from './actions-constants';

export type FixItem = CounterfactualSuggestionItem;

/** A normalized advice/polish row — a clamped headline + the full detail behind it.
 *  Unifies counterfactual stretch/reinforcement items and top-level Suggestions so
 *  the degraded + optional-polish lists render as tight expandable rows, never the
 *  multi-line prose paragraphs the raw Suggestion.text produced. */
export interface AdviceRow {
  headline: string;
  detail: string;
  /** Optional timestamp (ms) for fix rows — rendered as a right-aligned time chip. */
  timestampMs?: number;
}

export type ActionsView =
  | { kind: 'loading' }
  | {
      kind: 'needs-work';
      tone: 'crit' | 'mid';
      kicker: string;
      count: number;
      hero: FixItem;
      secondary: FixItem[];
    }
  | { kind: 'strong'; polish: AdviceRow[] }
  | { kind: 'degraded'; kicker: string; rows: AdviceRow[] }
  | { kind: 'all-set' };

export interface DeriveInput {
  ready: boolean;
  counterfactuals: CounterfactualResult | null;
  advice?: Suggestion[];
  /** hook_decomposition.weakest_modality — accepts both the long enum and short forms. */
  weakest?: string | null;
  isAV: boolean;
  /** overall_score (0-100). Fallback band source when Stage-11 counterfactuals are absent. */
  score?: number | null;
}

const MAX_SECONDARY = 3;
const MAX_POLISH = 3;
const MAX_ADVICE = 3;
// Mirrors verdict BAND_THRESHOLDS.STRONG (≥70 = "High potential"). A strong video
// with no counterfactuals should still get the confident ship-led treatment.
const STRONG_SCORE_MIN = 70;

/** Tighten a full suggestion sentence into a glanceable headline (first sentence,
 *  ≤8 words, no trailing punctuation). Full text stays available as the row detail. */
function clampHeadline(text: string): string {
  const raw = text.replace(/\s+/g, ' ').trim();
  const firstSentence = raw.match(/^(.{0,90}?[.!?])\s/)?.[1] ?? raw;
  let base = firstSentence.replace(/[.!?]+$/, '');
  const words = base.split(' ');
  if (words.length > 8) base = `${words.slice(0, 8).join(' ')}…`;
  return base;
}

function suggestionToRow(s: Suggestion): AdviceRow {
  return { headline: clampHeadline(s.text), detail: s.text };
}

function fixToRow(f: FixItem): AdviceRow {
  return {
    headline: f.headline,
    detail: f.detail ?? '',
    timestampMs: f.timestamp_ms > 0 ? f.timestamp_ms : undefined,
  };
}

// weakest_modality → the signal_anchor fragment its fix targets. Wires the
// previously-dead weakest_modality signal: it picks WHICH fix leads (mirrors the
// server's deriveOpeningLine), without ever surfacing the raw value as debug text.
const MODALITY_ANCHOR: Record<string, RegExp> = {
  visual_stop_power: /visual_stop_power/,
  visual: /visual_stop_power/,
  audio_hook_quality: /audio_hook_quality/,
  audio: /audio_hook_quality/,
  first_words_speech_score: /first_words_speech_score/,
  speech: /first_words_speech_score/,
  text_overlay_score: /text_overlay_score/,
  text_overlay: /text_overlay_score/,
};

/**
 * Choose the hero fix and the remainder. Prefers a fix whose signal_anchor
 * matches the weakest modality (earliest timestamp wins), else the first
 * `fix`-typed item, else the first item. Returns null when there are none.
 */
export function pickHeroFix(
  fixes: FixItem[],
  weakest?: string | null,
): { hero: FixItem; rest: FixItem[] } | null {
  if (fixes.length === 0) return null;
  const fixTyped = fixes.filter((f) => f.type === 'fix');
  const pool = fixTyped.length > 0 ? fixTyped : fixes;

  let hero = pool[0];
  if (!hero) return null;
  if (weakest) {
    const re = MODALITY_ANCHOR[weakest];
    if (re) {
      const match = pool
        .filter((f) => re.test(f.signal_anchor ?? ''))
        .sort((a, b) => a.timestamp_ms - b.timestamp_ms)[0];
      if (match) hero = match;
    }
  }
  const rest = fixes.filter((f) => f !== hero);
  return { hero, rest };
}

export function deriveActionsView(input: DeriveInput): ActionsView {
  const { ready, counterfactuals, advice, weakest, isAV, score } = input;
  if (!ready) return { kind: 'loading' };

  const band = counterfactuals?.band ?? null;
  const fixes = counterfactuals?.suggestions ?? [];

  // High band → ship-led. When Stage-11 counterfactuals are absent (band null) fall
  // back to the overall_score band so a strong video is handed confidence + a post
  // time, not a worklist or a wall of generic advice. Any stretch/reinforcement
  // items (else top-level advice) recede to quiet optional-polish rows.
  const effectiveHigh =
    band === 'high' || (band === null && (score ?? 0) >= STRONG_SCORE_MIN);
  if (effectiveHigh && !isAV) {
    const fromFixes = fixes.filter((f) => f.type !== 'fix').map(fixToRow);
    const polish = (fromFixes.length > 0 ? fromFixes : (advice ?? []).map(suggestionToRow)).slice(
      0,
      MAX_POLISH,
    );
    return { kind: 'strong', polish };
  }

  const picked = pickHeroFix(fixes, weakest);
  if (picked) {
    const tone: 'crit' | 'mid' = isAV || band === 'low' ? 'crit' : 'mid';
    const kicker = isAV
      ? ACTIONS_COPY.KICKER_AV
      : band === 'mid'
        ? ACTIONS_COPY.KICKER_MID
        : ACTIONS_COPY.KICKER_LOW;
    const count = fixes.filter((f) => f.type === 'fix').length || fixes.length;
    // Secondary rows are other *fixes* only — a needs-work list shouldn't carry
    // stretch ("ambitious extra") or reinforcement ("this is working") items.
    const secondary = picked.rest.filter((f) => f.type === 'fix').slice(0, MAX_SECONDARY);
    return { kind: 'needs-work', tone, kicker, count, hero: picked.hero, secondary };
  }

  // No counterfactual fixes (Stage 11 degraded) → fall back to top-level advice,
  // clamped to tight expandable rows (headline + detail), never raw prose.
  const rows = (advice ?? []).slice(0, MAX_ADVICE).map(suggestionToRow);
  if (rows.length > 0) {
    return { kind: 'degraded', kicker: ACTIONS_COPY.KICKER_DEGRADED, rows };
  }

  return { kind: 'all-set' };
}

/** FrameHero tone — maps a view-kind onto the shared kit's HeroTone palette. */
export type ActionsHeroTone = 'good' | 'warn' | 'crit' | 'neutral';

/** Pure hero spec for the shared FrameHero. Every view-kind resolves to the SAME
 *  Hero shape (label + verb headline + status word + one-line insight) so the
 *  frame stops looking like five different screens. No view-routing semantics
 *  change here — this only LABELS the view the router already chose. */
export interface ActionsHeroSpec {
  /** Caps label above the verb. */
  label: string;
  /** The ONE move, as a verb headline. */
  verb: string;
  tone: ActionsHeroTone;
  /** Short status word (tone-colored by FrameHero). */
  status: string;
  /** The why — one line. May be empty (e.g. needs-work uses the fix detail). */
  insight: string;
}

export function deriveActionsHero(view: ActionsView): ActionsHeroSpec | null {
  switch (view.kind) {
    case 'loading':
      return null;
    case 'strong':
      return {
        label: ACTIONS_COPY.HERO_LABEL,
        verb: ACTIONS_COPY.HERO_VERB_STRONG,
        tone: 'good',
        status: ACTIONS_COPY.HERO_STATUS_GOOD,
        insight: ACTIONS_COPY.HERO_INSIGHT_STRONG,
      };
    case 'all-set':
      return {
        label: ACTIONS_COPY.HERO_LABEL,
        verb: ACTIONS_COPY.HERO_VERB_ALL_SET,
        tone: 'good',
        status: ACTIONS_COPY.HERO_STATUS_GOOD,
        insight: ACTIONS_COPY.HERO_INSIGHT_ALL_SET,
      };
    case 'degraded':
      return {
        label: ACTIONS_COPY.HERO_LABEL,
        verb: ACTIONS_COPY.HERO_VERB_DEGRADED,
        tone: 'neutral',
        status: '',
        insight: ACTIONS_COPY.HERO_INSIGHT_DEGRADED,
      };
    case 'needs-work': {
      const isAV = view.kicker === ACTIONS_COPY.KICKER_AV;
      const crit = view.tone === 'crit';
      return {
        label: ACTIONS_COPY.HERO_LABEL,
        verb: isAV
          ? ACTIONS_COPY.HERO_VERB_AV
          : crit
            ? ACTIONS_COPY.HERO_VERB_REWORK
            : ACTIONS_COPY.HERO_VERB_POLISH,
        tone: crit ? 'crit' : 'warn',
        status: crit ? ACTIONS_COPY.HERO_STATUS_CRIT : ACTIONS_COPY.HERO_STATUS_WARN,
        // The why = the hero fix itself (the specific move to make). The fuller
        // detail + the copyable rewrite live in the rewrite block below the hero.
        insight: view.hero.headline,
      };
    }
  }
}

/** Unified list rows for the kit DataTable. needs-work surfaces secondary fixes;
 *  strong surfaces optional polish; degraded surfaces advice. The hero fix itself
 *  is NOT in this list (it lives in the hero rewrite block). */
export function deriveActionsRows(view: ActionsView): AdviceRow[] {
  switch (view.kind) {
    case 'needs-work':
      return view.secondary.map(fixToRow);
    case 'strong':
      return view.polish;
    case 'degraded':
      return view.rows;
    default:
      return [];
  }
}
