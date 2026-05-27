import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-04
import type { UseAudienceChoreographyResult } from '../use-audience-choreography';

void buildHeatmapFixture; // ensures fixture import resolves

describe('useAudienceChoreography', () => {
  it.todo('emits skeleton rows in PERSONA_SLOT_ORDER on wave_0_complete');
  it.todo('no rows emitted before wave_0_segmentation stage_end');
});
