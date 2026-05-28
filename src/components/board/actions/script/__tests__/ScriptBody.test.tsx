/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));

import { ScriptBody } from '../ScriptBody';
import { logger } from '@/lib/logger';
import type { ScriptResult } from '../script-types';

const sampleScript: ScriptResult = {
  is_empty_state: false,
  script: {
    opening_line: 'Lead with motion frame.',
    scene_order: ['0:00 — Hook with motion', '0:08 — Face reveal'],
    voiceover: 'Tighten hook timing.',
    captions: ['POV: you finally figured it out', 'Wait until 0:08'],
  },
  engine_version: 'v3.0.0',
  generated_at: '2026-05-28T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe('ScriptBody', () => {
  it('renders all 4 sections with verbatim labels', () => {
    render(<ScriptBody script={sampleScript} analysisId="aid-1" />);
    expect(screen.getByText('NEW OPENING')).toBeTruthy();
    expect(screen.getByText('SCENE ORDER')).toBeTruthy();
    expect(screen.getByText('VOICEOVER')).toBeTruthy();
    expect(screen.getByText('CAPTIONS')).toBeTruthy();
  });

  it('renders opening_line, scenes, voiceover, captions content', () => {
    render(<ScriptBody script={sampleScript} analysisId="aid-1" />);
    expect(screen.getByText('Lead with motion frame.')).toBeTruthy();
    expect(screen.getByText('0:00 — Hook with motion')).toBeTruthy();
    expect(screen.getByText('Tighten hook timing.')).toBeTruthy();
    expect(screen.getByText('POV: you finally figured it out')).toBeTruthy();
  });

  it('fires SCRIPT_SECTION_COPIED on per-section copy click', async () => {
    render(<ScriptBody script={sampleScript} analysisId="aid-1" />);
    const opening = screen.getByRole('button', { name: /Copy New Opening section/i });
    fireEvent.click(opening);
    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(
        'script_section_copied',
        expect.objectContaining({ section: 'opening', analysis_id: 'aid-1' }),
      );
    });
  });

  it('fires SCRIPT_COPY_ALL on Copy-all click', async () => {
    render(<ScriptBody script={sampleScript} analysisId="aid-1" />);
    const copyAll = screen.getByRole('button', { name: 'Copy full reshoot script' });
    fireEvent.click(copyAll);
    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(
        'script_copy_all',
        expect.objectContaining({ analysis_id: 'aid-1', has_empty_state: false }),
      );
    });
  });

  it('returns null for is_empty_state ScriptResult', () => {
    const { container } = render(
      <ScriptBody
        script={{
          is_empty_state: true,
          opening_variants: ['A', 'B'],
          engine_version: 'v3.0.0',
          generated_at: '2026-05-28T00:00:00Z',
        }}
        analysisId="aid-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('has data-testid="actions-reshoot-body"', () => {
    const { container } = render(<ScriptBody script={sampleScript} analysisId="aid-1" />);
    expect(container.querySelector('[data-testid="actions-reshoot-body"]')).toBeTruthy();
  });
});
