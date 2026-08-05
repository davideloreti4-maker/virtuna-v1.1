/** @vitest-environment node */
/**
 * P3 routing cut (ambient-room-v2) — the launch cut hid Discover/Competitors/Start by redirecting
 * their PARENTS to /home, but Next sub-routes don't inherit, so the orphans stayed live and two
 * redirect chains went stale:
 *   - /analyze -> /start -> /home        (dead 2-hop; /start is itself hidden)
 *   - /competitors -> /feed?tab=... -> /home  (dead 2-hop that also DROPS ?tab)
 *   - /feed/hooks, /feed/channels, /competitors/[handle], /competitors/compare  (live orphans)
 *   - /dev/cards shipped to production (auth-gated only, no env gate, despite its "dev" header)
 *
 * UPDATED 2026-07-29 — Discover was REACTIVATED, which inverts half of this file. The four
 * "orphans" above are sub-surfaces of the Discover hub, every one of them reachable from it:
 * DiscoverTabBar links Channels + Hooks, competitor cards/rows link [handle], and both the
 * competitors list and the intelligence section link compare. So the hub could not come back
 * alone — restoring /feed while they stayed stubbed would have shipped a tab bar whose own tabs
 * bounce to /home. Their guards now assert they RENDER, which is the same invariant read the
 * other way: the subtree agrees with itself. /start + /calendar are still hidden, and /dev is
 * still 404 in prod — those guards are unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(process.cwd(), 'src/app/(app)');
const read = (p: string) =>
  readFileSync(join(APP, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ── Source guards — hidden routes land on /home in ONE hop; the Discover subtree renders ──
describe('P3 routing cut — redirect destinations', () => {
  it('/analyze redirects straight to /home (not the hidden /start 2-hop)', () => {
    const src = read('analyze/page.tsx');
    expect(src).toMatch(/redirect\(\s*['"]\/home['"]\s*\)/);
    expect(src).not.toMatch(/redirect\(\s*['"]\/start['"]/);
  });
  it.each(['start/page.tsx', 'calendar/page.tsx'])(
    'still-hidden %s redirects to /home in one hop',
    (p) => {
      const src = read(p);
      expect(src).toMatch(/redirect\(\s*['"]\/home['"]\s*\)/);
    },
  );
});

describe('Discover subtree — reactivated 2026-07-29, every entry point resolves', () => {
  // The hub's own tab bar links Channels + Hooks; competitor cards/rows link [handle]; the
  // competitors list + intelligence section link compare. A redirect stub in ANY of these is a
  // nav item that bounces to /home — which is exactly what the launch cut left behind.
  it.each([
    'feed/page.tsx',
    'feed/channels/page.tsx',
    'feed/discover/page.tsx',
    'competitors/[handle]/page.tsx',
    'competitors/compare/page.tsx',
    'library/page.tsx',
  ])('%s renders a page — no redirect stub', (p) => {
    const src = read(p);
    expect(src).not.toMatch(/redirect\(\s*['"]\/home['"]\s*\)/);
    expect(src).toMatch(/export default (async )?function/);
  });

  it('/competitors RENDERS the board again — the tab it redirected to no longer exists', () => {
    // Until 2026-08-02 this deep-linked `/feed?tab=competitors`. The rework merged Channels
    // and Competitors into one Watchlist tab, so that target is gone; a redirect left pointing
    // at it would drop the visitor on Outliers, a different surface — the same dead-hop defect
    // this file was written for. The board is where you ADD a competitor and reach /compare,
    // so it has to resolve to something real.
    const src = read('competitors/page.tsx');
    expect(src).not.toMatch(/redirect\(/);
    expect(src).toMatch(/export default (async )?function/);
  });

  it('/saved and /discover redirect to their live targets in ONE hop', () => {
    // /saved → /library is deep-link preservation over the SAME saved_items store.
    expect(read('saved/page.tsx')).toMatch(/redirect\(\s*['"]\/library['"]\s*\)/);
    // /discover → /feed (owner call 2026-08-05). This asserted `/feed/discover` and the reason
    // it gave was the dead 2-hop: pointing at /feed used to mean bouncing on to somewhere else.
    // That argument no longer holds — `feed/page.tsx` renders a real page (the it.each above
    // asserts exactly that), so this is ONE hop onto a live surface.
    //
    // What decided it is what the redirect is FOR. This route exists only to honour bookmarks
    // saved when /discover was the browsable outlier grid: free, read-only. `/feed/discover` is
    // the on-demand Pull — a 5-credit Apify scrape. Sending an old browse link to a paid tool
    // answers a request to look with a request to spend. The hub is what those bookmarks meant,
    // and the Pull is one tab inside it.
    //
    // The 2-hop guard itself still stands: the target must be a PAGE, never another redirect.
    expect(read('discover/page.tsx')).toMatch(/redirect\(\s*['"]\/feed['"]\s*\)/);
    expect(read('feed/page.tsx')).not.toMatch(/redirect\(/);
  });

  it('the DiscoverTabBar navigates NOWHERE — every tab switches in place', () => {
    // Inverted by the 2026-08-02 rework, and the inversion is the point. This test used to
    // assert each tab's href resolved to a live page, because three of six tabs were separate
    // PAGES that each re-rendered the bar — which is exactly how the bar came to sit at 62px
    // on one tab and 78px on another, under an h1 that changed identity mid-nav. Outliers,
    // Collections and Watchlist are one client component's state, so a tab cannot bounce, jump
    // or go stale. An `href` reappearing here means the page split came back.
    const bar = readFileSync(
      join(process.cwd(), 'src/components/discover/discover-tab-bar.tsx'),
      'utf8',
    );
    expect(bar).not.toMatch(/href:/);
    expect(bar).not.toMatch(/from "next\/link"/);
  });

  it('/feed/hooks redirects to Collections, which replaced it', () => {
    // The Hooks tab rendered 12 hardcoded templates whose numbers were static illustration,
    // in the same green pill as the measured multipliers two tabs over. Collections carries
    // the same idea over the real corpus; the redirect keeps old links alive.
    expect(read('feed/hooks/page.tsx')).toMatch(/redirect\(\s*['"]\/feed\?tab=collections['"]\s*\)/);
  });
});

// ── Behavioral — /dev/* is gated OFF real production (the dev-cards gallery leaked to prod) ──
describe('P3 dev gate — /dev is notFound in production', () => {
  const notFound = vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  const ORIG = process.env.VERCEL_ENV;
  beforeEach(() => {
    vi.resetModules();
    notFound.mockClear();
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = ORIG;
  });

  async function loadLayout() {
    vi.doMock('next/navigation', () => ({ notFound }));
    return (await import('../dev/layout')).default;
  }

  it('calls notFound() when VERCEL_ENV=production', async () => {
    process.env.VERCEL_ENV = 'production';
    const Layout = await loadLayout();
    expect(() => (Layout as (p: { children: unknown }) => unknown)({ children: null })).toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(notFound).toHaveBeenCalled();
  });

  it('renders children on preview / local (VERCEL_ENV !== production)', async () => {
    process.env.VERCEL_ENV = 'preview';
    const Layout = await loadLayout();
    const out = (Layout as (p: { children: unknown }) => unknown)({ children: 'kids' });
    expect(notFound).not.toHaveBeenCalled();
    expect(out).toBe('kids');
  });
});
