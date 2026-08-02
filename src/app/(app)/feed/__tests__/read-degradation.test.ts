/** @vitest-environment node */
/**
 * /feed — the two reads degrade INDEPENDENTLY (2026-08-02).
 *
 * The hub's corpus read throws on a Supabase error, by the grounding layer's own convention
 * ("RPC failures throw; the caller wraps in try/catch + graceful degradation"). The caller
 * did neither: both reads were awaited in one `Promise.all`, so a corpus failure threw out
 * of the page, the (app) error boundary replaced the whole surface, and Watchlist — which
 * reads two entirely different tables through a different client — went down with it.
 *
 * These assert the split, and they assert the SHAPE of the degrade: a failed read must not
 * arrive at the UI as a confident zero, because an empty corpus and an unreadable one look
 * identical once the counts render.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMPTY_CORPUS, type DiscoverCorpus } from '@/lib/discover/corpus-reads';
import type { WatchlistData } from '@/lib/discover/watchlist-reads';

const mocks = vi.hoisted(() => ({
  getDiscoverCorpus: vi.fn(),
  getWatchlistData: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  }),
}));
vi.mock('@/lib/discover/corpus-reads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/discover/corpus-reads')>()),
  getDiscoverCorpus: mocks.getDiscoverCorpus,
}));
vi.mock('@/lib/discover/watchlist-reads', () => ({ getWatchlistData: mocks.getWatchlistData }));
// Stubbed so the page's return value is a plain element whose props we can read.
vi.mock('@/components/discover/discover-hub', () => ({ DiscoverHub: () => null }));

const CORPUS: DiscoverCorpus = {
  teardowns: {
    a: {
      id: 'a',
      videoUrl: 'https://tiktok.com/@x/video/1',
      coverUrl: null,
      handle: 'x',
      spokenHook: 'hook',
      template: 'template',
      archetype: 'question',
      niche: 'fitness',
      views: 1000,
      postedAt: '2026-06-10T00:00:00Z',
      multiplier: 4,
      baselineLabel: 'vs own',
      proven: true,
      extreme: false,
    },
  },
  feedIds: ['a'],
  collections: [],
  niches: [{ id: 'fitness', count: 1 }],
  totals: { videos: 1, proven: 1, collections: 0, creators: 1 },
};

const WATCHLIST: WatchlistData = {
  sources: [
    {
      key: 'k',
      handle: 'cbum',
      name: 'Chris Bumstead',
      avatarUrl: null,
      followerCount: 10,
      outlierCount: 0,
      bestMultiplier: null,
      videosHeld: 0,
      newestPostAt: null,
      mergedFrom: null,
      held: false,
      profileHandle: 'cbum',
    },
  ],
  latest: [],
};

type HubProps = {
  corpus: DiscoverCorpus;
  watchlist: WatchlistData;
  failures: { corpus: boolean; watchlist: boolean };
};

async function renderPage(): Promise<HubProps> {
  const Page = (await import('../page')).default;
  const el = (await Page({ searchParams: Promise.resolve({}) })) as { props: HubProps };
  return el.props;
}

describe('/feed — one failed read does not take the page down', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders with the Watchlist intact when the CORPUS read throws', async () => {
    mocks.getDiscoverCorpus.mockRejectedValue(new Error('PGRST — corpus unavailable'));
    mocks.getWatchlistData.mockResolvedValue(WATCHLIST);

    const props = await renderPage();

    expect(props.failures).toEqual({ corpus: true, watchlist: false });
    expect(props.corpus).toEqual(EMPTY_CORPUS);
    // The half that never touched the corpus is untouched — the whole point of the split.
    expect(props.watchlist.sources).toHaveLength(1);
  });

  it('renders the corpus when the WATCHLIST read throws', async () => {
    mocks.getDiscoverCorpus.mockResolvedValue(CORPUS);
    mocks.getWatchlistData.mockRejectedValue(new Error('watchlist unavailable'));

    const props = await renderPage();

    expect(props.failures).toEqual({ corpus: false, watchlist: true });
    expect(props.corpus.totals.proven).toBe(1);
    expect(props.watchlist).toEqual({ sources: [], latest: [] });
  });

  it('reports no failure when both reads succeed', async () => {
    mocks.getDiscoverCorpus.mockResolvedValue(CORPUS);
    mocks.getWatchlistData.mockResolvedValue(WATCHLIST);

    const props = await renderPage();

    expect(props.failures).toEqual({ corpus: false, watchlist: false });
  });

  it('flags the failure separately from the empty shape it degrades to', async () => {
    // An unreadable corpus and a genuinely empty one produce the SAME totals. Without the
    // flag beside them the header would state "0 proven outliers · 0 collections" about a
    // library it could not open, which is the failure mode this whole split exists to avoid.
    mocks.getDiscoverCorpus.mockRejectedValue(new Error('boom'));
    mocks.getWatchlistData.mockResolvedValue(WATCHLIST);

    const props = await renderPage();

    expect(props.corpus.totals.proven).toBe(0);
    expect(props.failures.corpus).toBe(true);
  });
});

describe('corpus read — the detail fields are NOT in the page payload', () => {
  it('does not select why_it_works or the taxonomy columns', () => {
    // `why_it_works` is a p50 of 578 chars over 524 rows: shipping it whole to every visitor
    // measured 173KB gzip against 75KB without it, and the 220-char excerpt it replaced was
    // never rendered by anything. One open dialog reads one row instead
    // (app/actions/discover/teardown.ts). A re-added column here is that payload coming back.
    const src = readFileSync(
      join(process.cwd(), 'src/lib/discover/corpus-reads.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const select = src.match(/\.select\(\s*"([^"]+)"/)?.[1] ?? '';
    expect(select).not.toContain('why_it_works');
    expect(select).not.toMatch(/\bformat\b/);
    expect(select).not.toContain('visual_hook');
    expect(select).not.toContain('editing_style');
    // …and the trimmed shape it maps to no longer carries the excerpt.
    expect(src).not.toContain('whyExcerpt');
  });
});
