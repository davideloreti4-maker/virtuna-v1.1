import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-06
import type { RebalanceResult } from '../weight-rebalance';

void buildHeatmapFixture; // ensures fixture import resolves

describe('weight-rebalance', () => {
  it.todo('proportional rebalance maintains sum = 1.0 ± 0.005');
  it.todo('no negative weights');
  it.todo('single slider drag to 100% sets others to 0');
});
