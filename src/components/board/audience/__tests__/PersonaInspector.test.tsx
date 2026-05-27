/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import { PersonaInspector } from '../PersonaInspector';
import type { HeatmapPayload } from '../audience-types';

// Mock useIsMobile to control mobile/desktop behavior
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false), // default desktop
}));

import { useIsMobile } from '@/hooks/useIsMobile';
const mockUseIsMobile = useIsMobile as ReturnType<typeof vi.fn>;

const mockOnOpenChange = vi.fn();
const mockOnJumpToSegment = vi.fn();

function makeHeatmap(overrides?: Partial<HeatmapPayload>): HeatmapPayload {
  return buildHeatmapFixture(overrides);
}

function renderInspector(
  personaId: string | null,
  heatmap: HeatmapPayload | null,
  open = true,
) {
  return render(
    <PersonaInspector
      open={open}
      onOpenChange={mockOnOpenChange}
      personaId={personaId}
      heatmap={heatmap}
      pass1Verdict="Strong hook"
      pass1Confidence={0.82}
      onJumpToSegment={mockOnJumpToSegment}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  mockUseIsMobile.mockReturnValue(false);
});

describe('PersonaInspector', () => {
  it('opens as Sheet side=right on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    renderInspector('persona_0', makeHeatmap());
    // Radix Dialog renders; look for sheet-content with right class
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).toBeTruthy();
    expect(sheetContent!.className).toMatch(/right-0|inset-y-0/);
  });

  it('opens as Sheet side=bottom on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    renderInspector('persona_0', makeHeatmap());
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).toBeTruthy();
    expect(sheetContent!.className).toMatch(/bottom-0|inset-x-0/);
  });

  it('renders archetype tag + persona name from heatmap', () => {
    renderInspector('persona_0', makeHeatmap());
    // persona_0 is slot_type 'fyp' archetype 'high_engager'
    expect(screen.getByText(/persona_0/i)).toBeInTheDocument();
  });

  it('renders segment_reasons list with Jump to segment buttons', () => {
    const heatmap = makeHeatmap({
      personas: [
        {
          id: 'persona_0',
          slot_type: 'fyp',
          attentions: Array.from({ length: 10 }, () => 0.7),
          swipe_predicted_at: null,
          segment_reasons: { 3: 'low engagement at visual cut' },
        },
        // Fill remaining 9 personas
        ...Array.from({ length: 9 }, (_, i) => ({
          id: `persona_${i + 1}`,
          slot_type: 'fyp' as const,
          attentions: Array.from({ length: 10 }, () => 0.5),
          swipe_predicted_at: null,
          segment_reasons: {} as Record<number, string>,
        })),
      ],
    });
    renderInspector('persona_0', heatmap);
    expect(screen.getByText(/low engagement at visual cut/i)).toBeInTheDocument();
    const jumpBtn = screen.getByRole('button', { name: /jump to segment/i });
    expect(jumpBtn).toBeInTheDocument();
  });

  it('Jump to segment button calls onJumpToSegment with segIdx', () => {
    const heatmap = makeHeatmap({
      personas: [
        {
          id: 'persona_0',
          slot_type: 'fyp',
          attentions: Array.from({ length: 10 }, () => 0.7),
          swipe_predicted_at: null,
          segment_reasons: { 3: 'low engagement' },
        },
        ...Array.from({ length: 9 }, (_, i) => ({
          id: `persona_${i + 1}`,
          slot_type: 'fyp' as const,
          attentions: Array.from({ length: 10 }, () => 0.5),
          swipe_predicted_at: null,
          segment_reasons: {} as Record<number, string>,
        })),
      ],
    });
    renderInspector('persona_0', heatmap);
    const jumpBtn = screen.getByRole('button', { name: /jump to segment/i });
    fireEvent.click(jumpBtn);
    expect(mockOnJumpToSegment).toHaveBeenCalledWith(3);
  });

  it('renders attention sparkline canvas', () => {
    renderInspector('persona_0', makeHeatmap());
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('renders empty state when personaId is null', () => {
    renderInspector(null, makeHeatmap());
    expect(screen.getByText(/no persona selected/i)).toBeInTheDocument();
  });

  it('renders empty state when persona not found in heatmap', () => {
    renderInspector('nonexistent_persona', makeHeatmap());
    expect(screen.getByText(/no persona selected/i)).toBeInTheDocument();
  });

  it('has max-w-[360px] on desktop side=right', () => {
    mockUseIsMobile.mockReturnValue(false);
    renderInspector('persona_0', makeHeatmap());
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).toBeTruthy();
    expect(sheetContent!.className).toMatch(/max-w-\[360px\]/);
  });

  it('has max-h-[85dvh] on mobile side=bottom', () => {
    mockUseIsMobile.mockReturnValue(true);
    renderInspector('persona_0', makeHeatmap());
    const sheetContent = document.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).toBeTruthy();
    expect(sheetContent!.className).toMatch(/max-h-\[85dvh\]/);
  });
});
