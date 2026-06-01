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

describe('EngineGroup — running state', () => {
  beforeEach(() => {
    useBoardStore.setState({ boardState: 'streaming', currentStageLabel: null });
    mockStream = { stages: [ev('stage_start', 0)], phase: 'analyzing', partial: { personas: [] }, result: null };
  });

  it('shows the active stage in plain English (no green-check stepper, no dev vocab)', () => {
    render(<EngineGroup />);
    // Visible label is the present-tense plain-English stage, ellipsis stripped.
    expect(screen.getByText('Reading the hook')).toBeInTheDocument();
    // None of the killed slop: no canonical "Qwen-VL segmentation" stepper rows.
    expect(screen.queryByText('Qwen-VL segmentation')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('shows the N / total step counter', () => {
    render(<EngineGroup />);
    expect(screen.getByTestId('engine-group').textContent).toContain('1 / 5');
  });

  it('aria-live announces the active stage label (with ellipsis)', () => {
    const { container } = render(<EngineGroup />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Reading the hook…');
  });

  it('does NOT render a latency headline or "Pipeline complete"', () => {
    render(<EngineGroup />);
    expect(screen.queryByText('Pipeline complete')).toBeNull();
    expect(screen.queryByText(/Qwen · 5 stages/)).toBeNull();
  });
});

describe('EngineGroup — complete state', () => {
  beforeEach(() => {
    useBoardStore.setState({ boardState: 'complete', currentStageLabel: null });
  });

  it('collapses to a one-line signal-coverage summary (no latency, no checks)', () => {
    mockStream = {
      stages: [],
      phase: 'complete',
      partial: { personas: [] },
      result: { signal_availability: { behavioral: true, gemini: true, ml: false } },
    };
    render(<EngineGroup />);
    const root = screen.getByTestId('engine-group');
    expect(root.textContent).toContain('2 of 3');
    expect(root.textContent).toContain('signals');
    expect(screen.queryByText('Pipeline complete')).toBeNull();
    expect(screen.queryByText(/12\.4s/)).toBeNull();
  });

  it('expands a findings list on demand', () => {
    mockStream = {
      stages: [],
      phase: 'complete',
      partial: { personas: [] },
      result: {
        signal_availability: { behavioral: true, gemini: true, ml: false },
        niche: 'fitness',
        content_type: 'video',
        hook_decomposition: { weakest_modality: 'text' },
        heatmap: { segments: [{}, {}] },
      },
    };
    render(<EngineGroup />);
    // Findings are hidden until the user opens them.
    expect(screen.queryByText('Niche')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /findings/i }));
    expect(screen.getByText('Niche')).toBeInTheDocument();
    expect(screen.getByText('Fitness')).toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
  });
});
