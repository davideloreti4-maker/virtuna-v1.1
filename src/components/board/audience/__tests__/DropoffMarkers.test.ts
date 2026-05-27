import { describe, it } from 'vitest';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

// @ts-expect-error -- created in Plan 04-05
import type { DropoffMarker } from '../DropoffMarkers';

void buildHeatmapFixture; // ensures fixture import resolves

describe('DropoffMarkers', () => {
  it.todo('clusters 3+ markers within 12px');
  it.todo('clusters 2+ within 6px');
  it.todo('findMarkerAtPoint hits within 22px radius');
  it.todo('single marker returns single, no cluster');
});
