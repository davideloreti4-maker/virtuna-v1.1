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
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountReadBlockRenderer } from '@/components/thread/account-read-block';
import { CREDIT_WALL_EVENT } from '@/lib/billing/credit-wall';
import { SESSION_EXPIRED_EVENT } from '@/lib/auth/session-expired';
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

    // Find the Ideas POST by URL rather than by position. It used to be call [0], but the
    // SaveAffordance this card mounts now reads its saved state from the store, so it issues a
    // GET /api/saved on mount and that lands first. The assertion here is about the Ideas
    // payload, never about which fetch happens to go out first.
    const ideasCall = (global.fetch as Mock).mock.calls.find(
      ([url]) => url === '/api/tools/ideas',
    );
    expect(ideasCall, 'the Ideas endpoint was never called').toBeDefined();
    const [, init] = ideasCall!;
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
/**
 * THE REFUSAL MUST NOT LOOK LIKE A BROKEN PRODUCT.
 *
 * `/api/tools/ideas` runs the credit gate, so a 402 and a 401 are shapes this button really gets
 * back. `fetch` does not reject on an HTTP status, and this handler pushed to /home regardless —
 * so a refused creator landed on an unchanged home screen with no new idea cards, no message, and
 * a button that had reset itself. Identical to the swallow removed from `use-remix-launch` and
 * `discover-client` in the same change; all three read their endpoint out of CHAIN_HANDOFFS, which
 * is why `session-401-coverage` (literal URLs only) could not see any of them.
 */
describe('AccountReadBlockRenderer — a refused write does not land on an empty /home', () => {
  const QUOTA_402 = {
    error: 'credit_quota_exceeded',
    message: '$1 unlocks the whole platform for 3 days — every skill, 50 credits.',
    tier: 'free',
    used: 0,
    limit: 10,
    inTrial: false,
    reason: 'trial_required',
    cost: 1,
  };

  /** `/api/saved` is fetched on mount by SaveAffordance — only the Ideas POST is under test. */
  function refuse(status: number, body: unknown) {
    global.fetch = vi.fn((url: string) =>
      url === '/api/tools/ideas'
        ? Promise.resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        : Promise.resolve(new Response('{}', { status: 200 })),
    ) as unknown as typeof fetch;
  }

  let walls: unknown[] = [];
  let sessions = 0;
  const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
  const onSession = () => sessions++;

  beforeEach(() => {
    walls = [];
    sessions = 0;
    window.addEventListener(CREDIT_WALL_EVENT, onWall);
    window.addEventListener(SESSION_EXPIRED_EVENT, onSession);
  });
  afterEach(() => {
    window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    window.removeEventListener(SESSION_EXPIRED_EVENT, onSession);
  });

  it('raises the credit wall on a 402 and does NOT navigate', async () => {
    refuse(402, QUOTA_402);
    renderWithClient(<AccountReadBlockRenderer block={makeBlock()} />);
    fireEvent.click(screen.getByTestId('account-read-write-strengths'));

    await waitFor(() => expect(walls).toHaveLength(1));
    expect((walls[0] as { message: string }).message).toBe(QUOTA_402.message);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('announces the dead session on a 401 and does NOT navigate', async () => {
    refuse(401, { error: 'Unauthorized' });
    renderWithClient(<AccountReadBlockRenderer block={makeBlock()} />);
    fireEvent.click(screen.getByTestId('account-read-write-strengths'));

    await waitFor(() => expect(sessions).toBe(1));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('re-arms the button on a 500 instead of navigating', async () => {
    refuse(500, { error: 'ideas_failed' });
    renderWithClient(<AccountReadBlockRenderer block={makeBlock()} />);
    const btn = screen.getByTestId('account-read-write-strengths');
    fireEvent.click(btn);

    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText(/write to my strengths/i)).toBeTruthy();
  });
});

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
