/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { TapPopover } from '../TapPopover';

void buildHeatmapFixture; // ensures fixture import resolves

describe('TapPopover (a11y)', () => {
  it.todo('focus-traps and returns focus on close');
});
