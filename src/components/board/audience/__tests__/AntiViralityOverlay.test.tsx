/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture, buildAntiViralityHeatmap } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { AntiViralityOverlay } from '../AntiViralityOverlay';

void buildHeatmapFixture;
void buildAntiViralityHeatmap; // ensures fixture imports resolve

describe('AntiViralityOverlay', () => {
  it.todo('reason=confidence only renders border + header dot, no chips');
  it.todo('reason=timeline_pattern renders fix chips below filmstrip');
  it.todo('reason=both combines treatments');
  it.todo('heatmap cells stay coral D-15 hard lock');
});
