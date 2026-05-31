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
  | { kind: 'strong'; polish: FixItem[] }
  | { kind: 'degraded'; kicker: string; rows: Suggestion[] }
  | { kind: 'all-set' };

export interface DeriveInput {
  ready: boolean;
  counterfactuals: CounterfactualResult | null;
  advice?: Suggestion[];
  /** hook_decomposition.weakest_modality — accepts both the long enum and short forms. */
  weakest?: string | null;
  isAV: boolean;
}

const MAX_SECONDARY = 3;
const MAX_POLISH = 3;
const MAX_ADVICE = 3;

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
  const { ready, counterfactuals, advice, weakest, isAV } = input;
  if (!ready) return { kind: 'loading' };

  const band = counterfactuals?.band ?? null;
  const fixes = counterfactuals?.suggestions ?? [];

  // High band (and not flagged anti-viral) → ship-led. A strong video shouldn't
  // be handed a worklist; surface when-to-post and let any stretch/reinforcement
  // items recede to optional polish.
  if (band === 'high' && !isAV) {
    const polish = fixes.filter((f) => f.type !== 'fix').slice(0, MAX_POLISH);
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

  // No counterfactual fixes (Stage 11 degraded) → fall back to top-level advice.
  const rows = (advice ?? []).slice(0, MAX_ADVICE);
  if (rows.length > 0) {
    return { kind: 'degraded', kicker: ACTIONS_COPY.KICKER_DEGRADED, rows };
  }

  return { kind: 'all-set' };
}
