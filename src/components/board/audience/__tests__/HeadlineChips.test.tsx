/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { HeadlineChips } from '../HeadlineChips';

void buildHeatmapFixture; // ensures fixture import resolves

describe('HeadlineChips', () => {
  it.todo('renders all 5 chips against fixture');
  it.todo('falls back to persona_behavioral_aggregate when weighted_* null');
  it.todo('shows skeleton during streaming phase');
});
