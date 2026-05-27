import { describe, it } from 'vitest';
import { buildHeatmapFixture } from '../../../../components/board/audience/__tests__/fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-06
import type { RecomputeWeightedCurveResult } from '../weighted-aggregator-client';

void buildHeatmapFixture; // ensures fixture import resolves

describe('weighted-aggregator-client', () => {
  it.todo('client recomputeWeightedCurve matches server buildWeightedCurve numerically');
  it.todo('normalizeOverSurvivors handles missing slot_types');
});
