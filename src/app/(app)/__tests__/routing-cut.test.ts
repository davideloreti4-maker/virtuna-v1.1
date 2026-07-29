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
    'feed/hooks/page.tsx',
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

  it('/competitors deep-links the hub tab (its target is live again, so the 2-hop is gone)', () => {
    const src = read('competitors/page.tsx');
    expect(src).toMatch(/redirect\(\s*['"]\/feed\?tab=competitors['"]\s*\)/);
  });

  it('/saved and /discover redirect to their live targets in ONE hop', () => {
    // /saved → /library is deep-link preservation over the SAME saved_items store.
    expect(read('saved/page.tsx')).toMatch(/redirect\(\s*['"]\/library['"]\s*\)/);
    // /discover → /feed/discover: the pull moved INTO the hub as its "Pull" tool tab. It must
    // point at the page, never back at /feed — that would drop the visitor on Watching, a
    // different surface, which is how this route became a dead 2-hop the last two times.
    expect(read('discover/page.tsx')).toMatch(/redirect\(\s*['"]\/feed\/discover['"]\s*\)/);
  });

  it('every DiscoverTabBar tab points at a route that renders', () => {
    // The bar IS the hub's nav. A tab whose href is a redirect stub is a nav item that
    // bounces — the exact defect the launch cut left behind. Read the hrefs from the bar
    // itself rather than restating them, so a new tab can't be added without a live page.
    const bar = readFileSync(
      join(process.cwd(), 'src/components/discover/discover-tab-bar.tsx'),
      'utf8',
    );
    const hrefs = [...bar.matchAll(/href:\s*"(\/feed[^"?]*)"/g)]
      .map((m) => m[1])
      .filter((h): h is string => Boolean(h));
    expect(hrefs).toEqual(expect.arrayContaining(['/feed/channels', '/feed/hooks', '/feed/discover']));
    for (const href of new Set(hrefs)) {
      const src = read(`${href.replace(/^\//, '')}/page.tsx`);
      expect(src, `${href} must render, not redirect`).not.toMatch(/redirect\(/);
    }
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
