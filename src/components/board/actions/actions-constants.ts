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
  SCRIPT_INSPECTOR_OPENED: 'script_inspector_opened',
  SCRIPT_EMPTY_STATE_SHOWN: 'script_empty_state_shown',
  OPTIMAL_POST_TZ_CONVERTED: 'optimal_post_tz_converted',
  OPTIMAL_POST_EDITED: 'optimal_post_edited',
  OPTIMAL_POST_SOURCE_EXPLAINED: 'optimal_post_source_explained',
  OPTIMAL_POST_RESET: 'optimal_post_reset_to_recommendation',
} as const;

// Frame-grow constants (per D-10).
export const ACTIONS_FRAME_DEFAULT_HEIGHT = 200;
export const ACTIONS_FRAME_AV_HEIGHT = 360;
// 3-card layout: top row + bottom row (AV: hero row + 2-card row)
export const ACTIONS_GRID_DEFAULT_ROWS = '88px 88px';
export const ACTIONS_GRID_AV_ROWS = '160px 1fr';
