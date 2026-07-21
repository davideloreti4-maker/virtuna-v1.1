/** @vitest-environment happy-dom */
/**
 * lane/polish §7 — the "Write to my strengths →" forward action on the Account Read card.
 *
 * Guards:
 *  - the CTA renders ONLY when there are strengths to seed from (honest — no empty run);
 *  - it is absent on the thin-history fallback and when `patterns.working` is empty;
 *  - a click POSTs the strengths as the Ideas steering `ask` to the registry endpoint
 *    (/api/tools/ideas) and then navigates to /home (the card-POST + navigate pattern).
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountReadBlockRenderer } from '@/components/thread/account-read-block';
import type { AccountReadBlock } from '@/lib/tools/blocks';

// The card calls useRouter() for the post-POST navigation — mock the app router.
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

// AccountReadBlockRenderer mounts SaveAffordance (useSaveItem → useQueryClient).
function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const STRENGTHS = ['Fast cold-open cuts', 'POV hooks that name the viewer'];

function makeBlock(overrides: Partial<AccountReadBlock['props']> = {}): AccountReadBlock {
  return {
    type: 'account-read',
    props: {
      handle: 'thecreator',
      patterns: {
        recurringHooks: ['You are doing X wrong'],
        formatMix: [{ label: 'Talking head', count: 5, pct: 60 }],
        dropPoints: ['3s — slow setup'],
        working: STRENGTHS,
        fix: ['Openers run long'],
      },
      trackRecord: null,
      ...overrides,
    },
  };
}

beforeEach(() => {
  cleanup();
  pushMock.mockReset();
  global.fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
});

describe('AccountReadBlockRenderer — "Write to my strengths →" forward action', () => {
  it('renders the CTA when there are strengths', () => {
    renderWithClient(<AccountReadBlockRenderer block={makeBlock()} />);
    expect(screen.getByTestId('account-read-write-strengths')).toBeTruthy();
    expect(screen.getByText(/write to my strengths/i)).toBeTruthy();
  });

  it('hides the CTA when patterns.working is empty (no empty seed)', () => {
    const block = makeBlock();
    block.props.patterns!.working = [];
    renderWithClient(<AccountReadBlockRenderer block={block} />);
    expect(screen.queryByTestId('account-read-write-strengths')).toBeNull();
  });

  it('hides the CTA on the thin-history fallback', () => {
    renderWithClient(
      <AccountReadBlockRenderer block={makeBlock({ fallback: 'thin', patterns: undefined })} />,
    );
    expect(screen.queryByTestId('account-read-write-strengths')).toBeNull();
  });

  it('POSTs the strengths as the Ideas `ask` then navigates to /home', async () => {
    renderWithClient(<AccountReadBlockRenderer block={makeBlock()} />);
    fireEvent.click(screen.getByTestId('account-read-write-strengths'));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/home'));

    const [url, init] = (global.fetch as Mock).mock.calls[0]!;
    expect(url).toBe('/api/tools/ideas');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.platform).toBe('tiktok');
    // The strengths ride the steering `ask` verbatim.
    expect(body.ask).toContain(STRENGTHS[0]);
    expect(body.ask).toContain(STRENGTHS[1]);
  });
});

/**
 * Standard-conformance guards (§0.5). The card carries NO hero headline (removed 2026-07-21 by
 * owner decision — the templated one-liner "didn't match into the UI"; the card now opens on the
 * real scrape identity + post strip). The data tone rides the bullet DOT, never the section label.
 */
describe('AccountReadBlockRenderer — standard conformance', () => {
  it('renders NO hero headline (removed — the card opens on identity, not a one-liner)', () => {
    renderWithClient(<AccountReadBlockRenderer block={makeBlock()} />);
    expect(screen.queryByTestId('account-read-hero')).toBeNull();
  });

  it('keeps section labels muted — the data tone rides the bullet DOT, not the label', () => {
    renderWithClient(<AccountReadBlockRenderer block={makeBlock()} />);
    const working = screen.getByTestId('account-read-working');
    // The label <p> carries no inline data color (it was success-green on the label before).
    const label = working.querySelector('p')!;
    expect(label.style.color).toBe('');
    expect(label.className).toContain('text-foreground-muted');
    // The success tone now lives on the bullet dot.
    const bullet = working.querySelector('li span') as HTMLElement;
    expect(bullet.style.backgroundColor).toContain('success');
  });
});
