/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-07
import { WeightOverrideDrawer } from '../WeightOverrideDrawer';

void buildHeatmapFixture; // ensures fixture import resolves

describe('WeightOverrideDrawer', () => {
  it.todo('Apply writes to analysis_override via /api/analyze/[id]/override');
  it.todo('Save as my default upserts creator_persona_weights');
  it.todo('Reset restores DEFAULT_PERSONA_WEIGHT_CONFIG with 4s undo toast');
});
