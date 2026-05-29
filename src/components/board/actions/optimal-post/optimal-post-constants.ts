// Verbatim copy contract per 06-UI-SPEC.md §Copywriting Contract.
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type DayOfWeek = typeof DAY_LABELS[number];

export const OPTIMAL_POST_COPY = {
  CARD_LABEL: 'When to post',
  EDIT_LINK: 'Edit',
  DONE_LINK: 'Done',
  SHEET_TITLE: 'Edit post time',
  DAY_SECTION_LABEL: 'Day',
  START_HOUR_LABEL: 'Start hour',
  END_HOUR_LABEL: 'End hour',
  SAVE_BUTTON: 'Save for this analysis',
  SOURCE_NICHE_LABEL: 'from your niche',
  SOURCE_FALLBACK_LABEL: 'default',
  SOURCE_CREATOR_LABEL: 'yours',
  SOURCE_FALLBACK_TOOLTIP:
    'Niche data unavailable yet — using the default Tue evening window. Add your niche to your creator profile for tailored timing.',
  SOURCE_CREATOR_TOOLTIP: 'Edited for this analysis. Reset to use the niche recommendation.',
  INFO_ARIA: 'View data source',
} as const;
