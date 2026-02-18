---
created: 2026-02-18T09:55:10.920Z
title: Prediction engine results card UI rework
area: ui
files:
  - src/components/viral-results/ViralResultsCard.tsx
  - src/components/viral-results/index.ts
  - src/components/app/simulation/results-panel.tsx
  - src/app/(app)/dashboard/dashboard-client.tsx
---

## Problem

The prediction engine results card (ViralResultsCard) needs a visual/structural rework. This is the component that displays output after the prediction engine processes a video analysis. Current UI may not effectively communicate the prediction results, tier scores, and actionable insights.

## Solution

TBD — requires design exploration. Key areas to consider:
- Visual hierarchy of prediction tier/score
- How ML confidence and calibration data are displayed (especially after ML rehabilitation phase)
- Actionable recommendations layout
- Mobile responsiveness
- Integration with updated aggregator output (5-signal schema after Phase 2)
