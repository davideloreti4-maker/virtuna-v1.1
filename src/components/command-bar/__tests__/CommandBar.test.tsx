/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock useBoardStore — use a simple closure-backed state
let _boardState = 'idle';
let _resetCalled = false;

vi.mock('@/stores/board-store', () => ({
  useBoardStore: (selector: (s: any) => any) => {
    const store = {
      boardState: _boardState,
      resetToIdle: () => { _resetCalled = true; _boardState = 'idle'; },
      startStreaming: vi.fn(),
      finishStreaming: vi.fn(),
    };
    return selector ? selector(store) : store;
  },
}));

// Mock useAnalysisStream
let _phase = 'idle';
let _analysisId: string | null = null;

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase: _phase,
    error: null,
    reconnect: vi.fn(),
    analysisId: _analysisId,
  }),
}));

// Mock usePrefersReducedMotion
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));

import { CommandBar } from '../CommandBar';

function setup(boardState = 'idle', phase = 'idle') {
  _boardState = boardState;
  _phase = phase;
  _resetCalled = false;
}

describe('CommandBar', () => {
  beforeEach(() => {
    setup('idle');
  });

  it('Test 1: idle — input enabled with idle placeholder, no chips', () => {
    setup('idle');
    render(<CommandBar />);
    const input = screen.getByRole('combobox', { name: 'Analysis command bar' });
    expect(input).not.toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Paste URL, drop file, or describe…');
    expect(screen.queryByRole('button', { name: 'Stop analysis' })).toBeNull();
  });

  it('Test 2: streaming — input disabled, Stop chip visible', () => {
    setup('streaming', 'analyzing');
    render(<CommandBar currentStage="Reading the hook…" />);
    const input = screen.getByRole('combobox');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Reading the hook…');
    expect(screen.getByRole('button', { name: 'Stop analysis' })).toBeInTheDocument();
  });

  it('Test 3: Stop chip calls onStop and resets board to idle', () => {
    setup('streaming');
    const onStop = vi.fn();
    render(<CommandBar onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop analysis' }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(_resetCalled).toBe(true);
  });

  it('Test 4: complete — 4 chip actions rendered and all disabled', () => {
    setup('complete');
    render(<CommandBar />);
    ['Rewrite hook', 'Compare to last 3', 'Generate variant', 'Re-weight audience'].forEach((label) => {
      const btn = screen.getByRole('button', { name: label });
      expect(btn).toBeDisabled();
    });
  });

  it('Test 5: submit non-empty text calls onSubmit with trimmed value', () => {
    setup('idle');
    const onSubmit = vi.fn();
    render(<CommandBar onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  https://tiktok.com/foo  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('https://tiktok.com/foo');
  });

  it('Test 6: whitespace submit is a no-op', () => {
    setup('idle');
    const onSubmit = vi.fn();
    render(<CommandBar onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Test 7: input has role=combobox and aria-label="Analysis command bar"', () => {
    setup('idle');
    render(<CommandBar />);
    const input = screen.getByRole('combobox', { name: 'Analysis command bar' });
    expect(input).toBeInTheDocument();
  });

  it('Test 8: edit-input — bar renders null', () => {
    setup('edit-input');
    const { container } = render(<CommandBar />);
    expect(container.firstChild).toBeNull();
  });
});
