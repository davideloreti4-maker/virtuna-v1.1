# Phase 8: Results Card & Breakdown UI — CONTEXT

> Decisions from discuss-phase session. Researchers and planners: treat these as locked unless user overrides.

## Factor Breakdown Display

### Locked Decisions
- **Score visualization**: Horizontal progress bars (filled bar + score number on right) — Raycast-style, clean and scannable
- **Detail level**: Expand-on-click — score always visible, click to reveal 1-line actionable tip and reasoning
- **Overall score**: Big hero score number at top, factor breakdown list underneath
- **Sort order**: Claude decides (recommend worst-first to surface improvements, but consider fixed order for consistency — pick what reads best)

### Implementation Notes
- Scores are 0-10 scale per factor (Scroll-Stop, Completion, Rewatch, Share Trigger, Emotional)
- Progress bar fill color should reflect score range (use coral accent for good scores, muted for low)
- Expand interaction should be smooth — no layout shift, use height animation

## Behavioral Predictions

### Locked Decisions
- **Display style**: Stat cards in a horizontal row — each card shows metric name, percentage, and small visual
- **Comparison context**: Claude decides — recommend showing "vs average" if available from API, otherwise just the number (don't fabricate benchmarks)
- **Section placement**: Claude decides — recommend separate section below factors ("What will happen" after "Why it scores this way")
- **Confidence indicator**: Subtle badge — small "High/Medium/Low confidence" tag near the results header, not a prominent meter

### Implementation Notes
- Metrics: completion %, share %, comment %, save %
- Stat cards should be responsive — 4 across on desktop, 2x2 grid on narrow screens
- Confidence maps to API's `confidence` field (0-1 scale → High/Medium/Low thresholds)

## Suggestions

### Locked Decisions
- **Before/after format**: After-only with context — show the improved version with a note about what changed (no side-by-side diff)
- **Grouping**: Claude decides — recommend by priority (highest impact first) but group by category if suggestions span many areas
- **Density**: All suggestions visible — no "show more" collapse
- **Effort tags**: Each suggestion tagged as Quick Win / Medium / Major — helps user prioritize what to act on

### Implementation Notes
- Suggestions come from API's `suggestions` array with `category`, `before`, `after`, `impact` fields
- Map `impact` score to effort tags (high impact + small change = Quick Win, etc.)
- "After only with context" means: show the improved text/element, with a subtle label explaining what was changed (e.g., "Shortened hook to 1.5s" or "Added trending sound")

## Persona Reactions

### Locked Decisions
- **Avatar style**: Match Raycast design language — likely initials in colored circles or minimal monochrome icons. No illustrated characters, no emojis. Keep it clean and systematic.
- **Reaction format**: Raycast-style — short, opinionated, scannable. Think quote-style verdict rather than paragraphs. First-person voice with clear behavioral outcome ("I'd share this" / "I'd scroll past").
- **Sentiment indicator**: Claude decides — recommend color-coded accent (green/yellow/red) or subtle icon that doesn't compete with the quote text
- **Density**: All personas visible (3-4 cards) — don't hide them, they're a key differentiator

### Implementation Notes
- Persona cards should have consistent sizing regardless of quote length
- Each persona has: name, demographic description, reaction quote, behavioral verdict
- Cards should feel like a horizontal row or grid — not a vertical list
- Match the muted background + accent color pattern from Raycast's card components

## Deferred Ideas
_(None raised during discussion)_

## Open Questions for Research
- What does the current API response shape look like for results? (factor scores, predictions, suggestions, personas)
- Are there existing UI components (cards, progress bars, badges) in the codebase to reuse?
- What's the current loading/skeleton pattern for async results?
