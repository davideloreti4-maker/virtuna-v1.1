---
created: 2026-02-18T09:55:10.920Z
closed: 2026-05-10
status: obsolete
title: Prediction engine results card UI rework
area: ui
files:
  - src/components/viral-results/ViralResultsCard.tsx
  - src/components/viral-results/index.ts
  - src/components/app/simulation/results-panel.tsx
  - src/app/(app)/dashboard/dashboard-client.tsx
---

## Resolution: Obsolete (closed 2026-05-10)

The named `ViralResultsCard.tsx` was superseded by the **UI Dashboard milestone** (shipped 2026-03-18). The actual production results display is now `src/components/app/simulation/results-panel.tsx` using `TikTokResultCard`, `HeroScore`, `FactorBreakdown`, `BehavioralPredictionsSection`, and `SuggestionsSection`.

The original concerns are addressed in the new architecture:
- Visual hierarchy of tier/score → `HeroScore` component
- ML confidence/calibration display → `WarningsBanner` + reasoning section in ResultsPanel
- Actionable recommendations → `SuggestionsSection`
- Integration with 5-signal aggregator → done in Prediction Engine v2 milestone (2026-02-17)

Cleanup performed in same closing commit: deleted unused `ViralResultsCard.tsx`, `RemixCTA.tsx`, `ConfidenceBadge.tsx`, `FactorProgressBar.tsx`, and `viral-results-showcase/` page. Trimmed `viral-results/index.ts` to keep only the still-referenced exports (`ViralScoreRing`, `FactorsList`, `FactorCard` — used by `viral-score-test/` page).

## Original Problem

The prediction engine results card (ViralResultsCard) needs a visual/structural rework. This is the component that displays output after the prediction engine processes a video analysis. Current UI may not effectively communicate the prediction results, tier scores, and actionable insights.

## Original Solution Notes

TBD — requires design exploration. Key areas to consider:
- Visual hierarchy of prediction tier/score
- How ML confidence and calibration data are displayed (especially after ML rehabilitation phase)
- Actionable recommendations layout
- Mobile responsiveness
- Integration with updated aggregator output (5-signal schema after Phase 2)
