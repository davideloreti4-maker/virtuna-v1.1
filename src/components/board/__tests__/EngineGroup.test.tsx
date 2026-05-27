/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBoardStore } from '@/stores/board-store';
import { deriveEngineStageStatus, EngineGroup } from '../EngineGroup';
import type { StageEvent, StageEventWave } from '@/lib/engine/events';

// Mock the stream hook to control stages + phase
let mockStream: { stages: StageEvent[]; phase: string; partial: { personas: unknown[] }; result: null | Record<string, unknown> } = {
  stages: [],
  phase: 'idle',
  partial: { personas: [] },
  result: null,
};
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => mockStream,
}));

function ev(type: 'stage_start' | 'stage_end', wave: StageEventWave): StageEvent {
  if (type === 'stage_start') return { type, stage: '', wave, timestamp_ms: 0 } as StageEvent;
  return { type, stage: '', wave, duration_ms: 0, cost_cents: 0, ok: true } as StageEvent;
}

describe('deriveEngineStageStatus', () => {
  const STAGE = { label: '', plainEnglish: '', waveMatch: (e: StageEvent) => 'wave' in e && e.wave === 0 };
  it('waiting when no events', () => expect(deriveEngineStageStatus([], STAGE)).toBe('waiting'));
  it('active on stage_start only', () => expect(deriveEngineStageStatus([ev('stage_start', 0)], STAGE)).toBe('active'));
  it('complete after stage_end', () => expect(deriveEngineStageStatus([ev('stage_start', 0), ev('stage_end', 0)], STAGE)).toBe('complete'));
});

describe('EngineGroup', () => {
  beforeEach(() => {
    useBoardStore.setState({
      boardState: 'streaming',
      currentStageLabel: null,
    });
    mockStream = { stages: [], phase: 'analyzing', partial: { personas: [] }, result: null };
  });

  it('renders 5 children all waiting', () => {
    render(<EngineGroup />);
    ['Qwen-VL segmentation', 'Hook decomp', 'Retention model', 'Persona simulator', 'Aggregator'].forEach((l) =>
      expect(screen.getByText(l)).toBeInTheDocument(),
    );
  });

  it('collapses to View pipeline → on complete', () => {
    mockStream = { stages: [], phase: 'complete', partial: { personas: [] }, result: {} };
    render(<EngineGroup />);
    expect(screen.getByRole('button', { name: /View pipeline/ })).toBeInTheDocument();
  });

  it('aria-live label updates with active stage', () => {
    mockStream = { stages: [ev('stage_start', 0)], phase: 'analyzing', partial: { personas: [] }, result: null };
    const { container } = render(<EngineGroup />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Reading the hook…');
  });

  it('re-expands when View pipeline badge is clicked', () => {
    mockStream = { stages: [], phase: 'complete', partial: { personas: [] }, result: {} };
    render(<EngineGroup />);
    const badge = screen.getByRole('button', { name: /View pipeline/ });
    fireEvent.click(badge);
    expect(screen.getByText('Qwen-VL segmentation')).toBeInTheDocument();
  });

  it('child 0 active when stage_start wave 0 received', () => {
    mockStream = { stages: [ev('stage_start', 0)], phase: 'analyzing', partial: { personas: [] }, result: null };
    render(<EngineGroup />);
    // aria-live should show the active stage label
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Reading the hook…');
  });
});
