// Verbatim copy from 05-UI-SPEC.md §Copywriting Contract. DO NOT paraphrase.
export const COPY = {
  RESHOOT_LABEL: 'Reshoot script',
  RESHOOT_PHASE: '6' as const,
  OPTIMAL_POST_LABEL: 'When to post',
  OPTIMAL_POST_PHASE: '6' as const,
  SHARE_LABEL: 'Share & export',
  SHARE_PHASE: '7' as const,
  COMING_PREFIX: 'Coming in Phase',
  SIMILAR_VIDEOS_TITLE: 'Similar videos',
  // CTA-style: used when truly zero items (no prior analyses yet)
  SIMILAR_VIDEOS_EMPTY: 'No similar videos yet — try a new analysis',
  // Unavailable: used when signal exists but retrieval data is absent for this analysis
  SIMILAR_VIDEOS_UNAVAILABLE: "Similar videos isn't available for this analysis",
} as const;

// Telemetry event names (per 05-CONTEXT.md D-31).
export const TELEMETRY = {
  ACTIONS_RESHOOT_PLACEHOLDER_VISIBLE: 'actions_reshoot_placeholder_visible',
  SIMILAR_VIDEO_TAPPED: 'similar_video_tapped',
} as const;

// Frame-grow constants (per D-10).
export const ACTIONS_FRAME_DEFAULT_HEIGHT = 200;
export const ACTIONS_FRAME_AV_HEIGHT = 360;
export const ACTIONS_GRID_DEFAULT_ROWS = '88px 88px';
export const ACTIONS_GRID_AV_ROWS = '160px 1fr';
