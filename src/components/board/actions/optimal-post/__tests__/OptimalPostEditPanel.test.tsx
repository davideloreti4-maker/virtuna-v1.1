/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));

// Stub fetch for the mutation
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { OptimalPostEditPanel } from '../OptimalPostEditPanel';
import { logger } from '@/lib/logger';

const original = {
  day_of_week: 'Tue' as const,
  hour_range: [18, 21] as [number, number],
  timezone: 'UTC' as const,
  reasoning: 'Niche peaks Tue (n=12 videos)',
  source: 'niche' as const,
};

function Wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as unknown as Response);
});

describe('OptimalPostEditPanel (inline editor — no drawer)', () => {
  it('renders 7 day-of-week pills in radiogroup', () => {
    render(<Wrap>
      <OptimalPostEditPanel
        currentWindow={{ day_of_week: 'Tue', hour_range: [18, 21] }}
        originalWindow={original}
        analysisId="aid-1"
        onDone={() => {}}
      />
    </Wrap>);
    const group = screen.getByRole('radiogroup', { name: 'Day of week' });
    expect(group).toBeTruthy();
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((d) => expect(screen.getByText(d)).toBeTruthy());
  });

  it('Save button triggers POST, fires OPTIMAL_POST_EDITED and calls onDone', async () => {
    const onDone = vi.fn();
    render(<Wrap>
      <OptimalPostEditPanel
        currentWindow={{ day_of_week: 'Tue', hour_range: [18, 21] }}
        originalWindow={original}
        analysisId="aid-1"
        onDone={onDone}
      />
    </Wrap>);
    fireEvent.click(screen.getByText('Save for this analysis'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/analyze/aid-1/optimal-post-override');
    expect(init.method).toBe('POST');
    await waitFor(() => expect(logger.info).toHaveBeenCalledWith(
      'optimal_post_edited',
      expect.objectContaining({ analysis_id: 'aid-1' }),
    ));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('Reset link posts { clear: true } and fires OPTIMAL_POST_RESET telemetry (D-27)', async () => {
    render(<Wrap>
      <OptimalPostEditPanel
        currentWindow={{ day_of_week: 'Thu', hour_range: [20, 23] }}
        originalWindow={original}
        analysisId="aid-1"
        onDone={() => {}}
      />
    </Wrap>);
    // Reset link label includes formatted hours; partial match is robust
    const reset = screen.getByText(/Reset to Tue/);
    fireEvent.click(reset);
    await waitFor(() => expect(logger.info).toHaveBeenCalledWith(
      'optimal_post_reset_to_recommendation',
      expect.objectContaining({ analysis_id: 'aid-1' }),
    ));
    // D-27: Verify fetch was called with { clear: true } body (NOT with day/hours)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!;
    expect(url).toBe('/api/analyze/aid-1/optimal-post-override');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ clear: true });
    expect(body.day_of_week).toBeUndefined();
    expect(body.hour_range).toBeUndefined();
  });
});
