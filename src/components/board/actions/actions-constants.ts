// Verbatim copy from 05-UI-SPEC.md §Copywriting Contract. DO NOT paraphrase.
export const COPY = {
  RESHOOT_LABEL: 'Reshoot script',
  RESHOOT_PHASE: '6' as const,
  OPTIMAL_POST_LABEL: 'When to post',
  OPTIMAL_POST_PHASE: '6' as const,
  SHARE_LABEL: 'Share & export',
  SHARE_PHASE: '7' as const,
  COMING_PREFIX: 'Coming in Phase',
} as const;

// Telemetry event names (per 05-CONTEXT.md D-31 + Phase 6 D-30).
export const TELEMETRY = {
  ACTIONS_RESHOOT_PLACEHOLDER_VISIBLE: 'actions_reshoot_placeholder_visible',
  SCRIPT_SECTION_COPIED: 'script_section_copied',
  SCRIPT_COPY_ALL: 'script_copy_all',
  // Fired once when the reshoot script first renders inline (replaces the old
  // drawer-open SCRIPT_INSPECTOR_OPENED event — the script is no longer behind a Sheet).
  SCRIPT_INLINE_VISIBLE: 'script_inline_visible',
  SCRIPT_EMPTY_STATE_SHOWN: 'script_empty_state_shown',
  OPTIMAL_POST_TZ_CONVERTED: 'optimal_post_tz_converted',
  OPTIMAL_POST_EDITED: 'optimal_post_edited',
  OPTIMAL_POST_SOURCE_EXPLAINED: 'optimal_post_source_explained',
  OPTIMAL_POST_RESET: 'optimal_post_reset_to_recommendation',
  // Fired when the user expands the collapsible factor scorecard.
  ACTIONS_SCORECARD_EXPANDED: 'actions_scorecard_expanded',
  // Action-led redesign: which view shape rendered (needs-work/strong/degraded/all-set).
  ACTIONS_VIEW_RENDERED: 'actions_view_rendered',
  // User copied the hero rewrite text-link.
  ACTIONS_REWRITE_COPIED: 'actions_rewrite_copied',
  // User expanded a secondary fix row.
  ACTIONS_FIX_EXPANDED: 'actions_fix_expanded',
} as const;

// Action-led redesign copy. Templated + band-keyed (instant, no LLM quality risk).
// The Actions frame owns "what to do" only — the score/verdict/breakdown live in
// the Score frame directly above it, so nothing here repeats a number or verdict.
export const ACTIONS_COPY = {
  // FrameHero label (caps) — one constant verb anchor across every view-kind.
  HERO_LABEL: 'Next move',
  // Hero verb headlines (the ONE move), tone-keyed.
  HERO_VERB_STRONG: 'Post it',
  HERO_VERB_POLISH: 'Polish the hook',
  HERO_VERB_REWORK: 'Rework it',
  HERO_VERB_AV: 'Fix before posting',
  HERO_VERB_DEGRADED: 'Sharpen these',
  HERO_VERB_ALL_SET: 'You’re all set',
  // Hero status words (tone color, set by FrameHero).
  HERO_STATUS_GOOD: 'Ready',
  HERO_STATUS_WARN: 'One quick pass',
  HERO_STATUS_CRIT: 'Hold',
  // Hero insight (the why), one line.
  HERO_INSIGHT_STRONG: 'Nothing’s holding the video back — your audience peaks at the time below.',
  HERO_INSIGHT_ALL_SET: 'Nothing to fix — just pick your moment.',
  HERO_INSIGHT_DEGRADED: 'A few tweaks below will sharpen the edit before you post.',
  // Section heads (DataTable / best-time). Stored in readable case; the section
  // header applies `uppercase` via CSS (so getByText matchers stay legible).
  SECTION_FIXES: 'Fixes',
  SECTION_POLISH: 'Optional polish',
  SECTION_WHEN: 'When to post',
  KICKER_LOW: 'Fix first',
  KICKER_MID: 'Worth a quick pass',
  KICKER_AV: 'Fix before posting',
  KICKER_DEGRADED: 'Where to focus',
  KICKER_STRONG: 'Post it',
  KICKER_POLISH: 'Optional polish',
  COUNT_SUFFIX: 'to go',
  COPY_REWRITE: 'Copy rewrite',
  COPIED: 'Copied',
  BEST_TIME: 'Best time',
  BEST_GUESS: 'best guess',
  EDIT_TIME: 'Edit time',
  STRONG_SUB: 'Your audience peaks then, and nothing’s holding the video back.',
  ALL_SET: 'You’re all set',
  ALL_SET_SUB: 'Nothing to fix — just pick your moment.',
} as const;

// Copy for the "What to fix" section (top counterfactual fixes + factor scorecard).
export const FIXES_COPY = {
  SECTION_LABEL: 'What to fix',
  SCORECARD_LABEL: 'Score breakdown',
  EMPTY: 'No extra tweaks — the breakdown below shows why.',
  TYPE_FIX: 'Fix',
  TYPE_STRETCH: 'Stretch',
  TYPE_REINFORCEMENT: 'Keep',
} as const;
