/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { HeatmapDrawer } from '../HeatmapDrawer';

void buildHeatmapFixture; // ensures fixture import resolves

describe('HeatmapDrawer', () => {
  it.todo('renders 10 × N grid, attention-proportional fills');
  it.todo('desktop inline expand via grid-template-rows');
  it.todo('hook zone column highlight');
});
