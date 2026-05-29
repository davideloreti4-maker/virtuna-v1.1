/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
// EngineGroup hydrates from permalink REST cache via usePermalinkAnalysis;
// stub so tests don't need QueryClientProvider + Next router params.
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => ({ id: null, data: null, isLoading: false }),
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
    // Compact layout renders icon-only glyphs; the stage label is exposed via
    // aria-label on each <li>, queried by role+name.
    ['Qwen-VL segmentation', 'Hook decomp', 'Retention model', 'Persona simulator', 'Aggregator'].forEach((l) =>
      expect(screen.getByRole('listitem', { name: `${l}: waiting` })).toBeInTheDocument(),
    );
  });

  it('renders all 5 stages complete on history (complete phase, empty events)', () => {
    mockStream = { stages: [], phase: 'complete', partial: { personas: [] }, result: {} };
    render(<EngineGroup />);
    ['Qwen-VL segmentation', 'Hook decomp', 'Retention model', 'Persona simulator', 'Aggregator'].forEach((l) =>
      expect(screen.getByRole('listitem', { name: `${l}: complete` })).toBeInTheDocument(),
    );
  });

  it('shows "Pipeline complete" + total latency from result on history', () => {
    mockStream = { stages: [], phase: 'complete', partial: { personas: [] }, result: { latency_ms: 12400 } };
    render(<EngineGroup />);
    expect(screen.getByText('Pipeline complete')).toBeInTheDocument();
    expect(screen.getByText(/Qwen · 5 stages · 12\.4s/)).toBeInTheDocument();
  });

  it('shows past-tense subtitle for completed stages', () => {
    mockStream = { stages: [], phase: 'complete', partial: { personas: [] }, result: {} };
    render(<EngineGroup />);
    expect(screen.getByText('Simulated 10 viewer personas')).toBeInTheDocument();
  });

  it('aria-live label updates with active stage', () => {
    mockStream = { stages: [ev('stage_start', 0)], phase: 'analyzing', partial: { personas: [] }, result: null };
    const { container } = render(<EngineGroup />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Reading the hook…');
  });

  it('child 0 active when stage_start wave 0 received', () => {
    mockStream = { stages: [ev('stage_start', 0)], phase: 'analyzing', partial: { personas: [] }, result: null };
    render(<EngineGroup />);
    // aria-live should show the active stage label
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Reading the hook…');
  });
});
