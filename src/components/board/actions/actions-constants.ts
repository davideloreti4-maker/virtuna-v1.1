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
