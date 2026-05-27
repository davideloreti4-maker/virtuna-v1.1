/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { HeatmapDrawer } from '../HeatmapDrawer';

void buildHeatmapFixture; // ensures fixture import resolves

describe('HeatmapDrawer (a11y)', () => {
  it.todo('passes axe-core with role=grid + aria-rowcount=10 + aria-colcount');
});
