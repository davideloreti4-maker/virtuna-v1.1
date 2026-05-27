/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { RetentionCurve } from '../RetentionCurve';

void buildHeatmapFixture; // ensures fixture import resolves

describe('RetentionCurve (reduced-motion)', () => {
  it.todo('jump-cuts to weighted curve when prefers-reduced-motion set');
  it.todo('no RAF morph loop scheduled');
});
