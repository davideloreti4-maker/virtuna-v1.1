/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { TapPopover } from '../TapPopover';

void buildHeatmapFixture; // ensures fixture import resolves

describe('TapPopover', () => {
  it.todo('positions at tap coordinate via PopoverAnchor virtualRef');
  it.todo('dismisses on Escape');
  it.todo('dismisses on scroll > 40px');
});
