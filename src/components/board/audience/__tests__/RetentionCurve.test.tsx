/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { RetentionCurve } from '../RetentionCurve';

void buildHeatmapFixture; // ensures fixture import resolves

describe('RetentionCurve', () => {
  it.todo('renders weighted_curve from fixture, DPR-aware');
  it.todo('draws hook zone warm band 0-3s');
  it.todo('morphs baseline → weighted in 800ms');
});
