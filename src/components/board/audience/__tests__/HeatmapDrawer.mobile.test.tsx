/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { HeatmapDrawer } from '../HeatmapDrawer';

void buildHeatmapFixture; // ensures fixture import resolves

describe('HeatmapDrawer (mobile)', () => {
  it.todo('opens bottom-sheet on mobile via Sheet side=bottom');
});
