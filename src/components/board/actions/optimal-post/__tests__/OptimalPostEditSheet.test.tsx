/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('@phosphor-icons/react', () => ({
  Info: ({ size, ...rest }: { size?: number }) => <svg width={size} height={size} data-testid="icon-info" {...rest} />,
  X: ({ size, ...rest }: { size?: number }) => <svg width={size} height={size} data-testid="icon-x" {...rest} />,
}));

// Stub fetch for the mutation
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { OptimalPostEditSheet } from '../OptimalPostEditSheet';
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

describe('OptimalPostEditSheet', () => {
  it('renders 7 day-of-week pills in radiogroup', () => {
    const triggerRef = { current: null as HTMLButtonElement | null };
    render(<Wrap>
      <OptimalPostEditSheet
        open={true}
        onOpenChange={() => {}}
        currentWindow={{ day_of_week: 'Tue', hour_range: [18, 21] }}
        originalWindow={original}
        analysisId="aid-1"
        triggerRef={triggerRef as React.RefObject<HTMLButtonElement>}
      />
    </Wrap>);
    const group = screen.getByRole('radiogroup', { name: 'Day of week' });
    expect(group).toBeTruthy();
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((d) => expect(screen.getByText(d)).toBeTruthy());
  });

  it('Save button triggers POST and fires OPTIMAL_POST_EDITED', async () => {
    const onOpenChange = vi.fn();
    const triggerRef = { current: null as HTMLButtonElement | null };
    render(<Wrap>
      <OptimalPostEditSheet
        open={true}
        onOpenChange={onOpenChange}
        currentWindow={{ day_of_week: 'Tue', hour_range: [18, 21] }}
        originalWindow={original}
        analysisId="aid-1"
        triggerRef={triggerRef as React.RefObject<HTMLButtonElement>}
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
  });

  it('Reset link posts { clear: true } and fires OPTIMAL_POST_RESET telemetry (D-27)', async () => {
    const triggerRef = { current: null as HTMLButtonElement | null };
    render(<Wrap>
      <OptimalPostEditSheet
        open={true}
        onOpenChange={() => {}}
        currentWindow={{ day_of_week: 'Thu', hour_range: [20, 23] }}
        originalWindow={original}
        analysisId="aid-1"
        triggerRef={triggerRef as React.RefObject<HTMLButtonElement>}
      />
    </Wrap>);
    // Reset link label includes formatted hours; partial match is robust
    const reset = screen.getByText(/Reset to Tue/);
    fireEvent.click(reset);
    // Verify telemetry
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
