/** @vitest-environment happy-dom */
import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import { PersonaInspector } from '../PersonaInspector';

void buildHeatmapFixture; // ensures fixture import resolves

describe('PersonaInspector', () => {
  it.todo('opens as right-side sheet on desktop, bottom-sheet on mobile via useIsMobile');
  it.todo('Jump to segment triggers setActivePreset audience');
});
