// Verbatim copy contract per 06-UI-SPEC.md §Copywriting Contract. DO NOT paraphrase.
export const SCRIPT_COPY = {
  SECTION_NEW_OPENING: 'NEW OPENING',
  SECTION_SCENE_ORDER: 'SCENE ORDER',
  SECTION_VOICEOVER: 'VOICEOVER',
  SECTION_CAPTIONS: 'CAPTIONS',
  COPY_ALL_LABEL: 'Copy all',
  COPY_ALL_ARIA: 'Copy full reshoot script',
  COPY_ALL_TITLE: 'Copy full reshoot script',
  AV_HEADLINE: 'Try this instead',
  AV_SUBHEAD: '4-section rewrite based on what dropped',
  TEASER_LABEL: 'Reshoot script',
  TEASER_AFFORDANCE: 'Open script →',
  EMPTY_HEADLINE: 'Your video is solid',
  EMPTY_SUBHEAD: 'Optional tweaks below',
  EMPTY_AB_LABEL: 'A/B opening',
  ERROR_MESSAGE: "Couldn't generate script",
  ERROR_RETRY: 'Try again',
  // Copy-all markdown headers (per 06-UI-SPEC.md §Copy-all Output Format)
  MD_HEADER_OPENING: '## New Opening',
  MD_HEADER_SCENES: '## Scene Order',
  MD_HEADER_VOICEOVER: '## Voiceover',
  MD_HEADER_CAPTIONS: '## Captions',
  // aria-live announcement strings (per 06-UI-SPEC.md §Aria-live Announcements)
  ARIA_SCRIPT_READY: 'Reshoot script ready — 4 sections.',
  // ARIA_EMPTY_STATE built at runtime with variant_count
} as const;
