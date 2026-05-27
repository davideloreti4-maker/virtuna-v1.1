import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-06
import type { ClientWeights } from '../use-client-weights';

void buildHeatmapFixture; // ensures fixture import resolves

describe('useClientWeights', () => {
  it.todo('client recompute matches server buildWeightedCurve byte-for-byte against fixture');
  it.todo('16ms RAF debounce on slider drag');
  it.todo('anti-virality re-evaluates during drag');
});
