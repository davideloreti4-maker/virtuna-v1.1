/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn() },
}));

import { ScriptEmptyState } from '../ScriptEmptyState';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../../actions-constants';

describe('ScriptEmptyState', () => {
  it('renders empty-state with headline + variants', () => {
    render(<ScriptEmptyState variant="empty-state" openingVariants={['Lead with X', 'Lead with Y']} analysisId="aid-1" />);
    expect(screen.getByText('Your video is solid')).toBeTruthy();
    expect(screen.getByText('Optional tweaks below')).toBeTruthy();
    expect(screen.getByText('Lead with X')).toBeTruthy();
    expect(screen.getByText('Lead with Y')).toBeTruthy();
  });

  it('renders error variant with retry button', () => {
    const onRetry = vi.fn();
    render(<ScriptEmptyState variant="error" analysisId="aid-1" onRetry={onRetry} />);
    expect(screen.getByText("Couldn't generate script")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('fires SCRIPT_EMPTY_STATE_SHOWN telemetry once on mount', () => {
    render(<ScriptEmptyState variant="empty-state" openingVariants={['x']} analysisId="aid-1" />);
    expect(logger.info).toHaveBeenCalledWith(
      TELEMETRY.SCRIPT_EMPTY_STATE_SHOWN,
      expect.objectContaining({ analysis_id: 'aid-1', variant_count: 1 }),
    );
  });
});
