/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { Filmstrip } from '../Filmstrip';

void buildHeatmapFixture; // ensures fixture import resolves

describe('Filmstrip', () => {
  it.todo('swaps placeholder → img on filmstrip_segment_ready');
  it.todo('renders coral band + label as initial placeholder per O-4');
  it.todo('horizontal scroll on overflow');
});
