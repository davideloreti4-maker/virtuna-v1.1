/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { PersonaRow } from '../PersonaRow';

void buildHeatmapFixture; // ensures fixture import resolves

describe('PersonaRow', () => {
  it.todo('renders Skeleton in skeleton state');
  it.todo('applies L→R cell wave transition-delay stagger 18ms per cell');
  it.todo('displays swipe marker at swipe_predicted_at column');
});
