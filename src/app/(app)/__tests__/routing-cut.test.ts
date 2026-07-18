/** @vitest-environment node */
/**
 * P3 routing cut (ambient-room-v2) — the launch cut hid Discover/Competitors/Start by redirecting
 * their PARENTS to /home, but Next sub-routes don't inherit, so the orphans stayed live and two
 * redirect chains went stale:
 *   - /analyze -> /start -> /home        (dead 2-hop; /start is itself hidden)
 *   - /competitors -> /feed?tab=... -> /home  (dead 2-hop that also DROPS ?tab)
 *   - /feed/hooks, /feed/channels, /competitors/[handle], /competitors/compare  (live orphans)
 *   - /dev/cards shipped to production (auth-gated only, no env gate, despite its "dev" header)
 * These guards lock the fix: every hidden route lands on /home in ONE hop, and /dev is 404 in prod.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(process.cwd(), 'src/app/(app)');
const read = (p: string) =>
  readFileSync(join(APP, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ── Source guards — redirect destinations collapse to /home; no dead 2-hops or leaked orphans ──
describe('P3 routing cut — redirect destinations', () => {
  it('/analyze redirects straight to /home (not the hidden /start 2-hop)', () => {
    const src = read('analyze/page.tsx');
    expect(src).toMatch(/redirect\(\s*['"]\/home['"]\s*\)/);
    expect(src).not.toMatch(/redirect\(\s*['"]\/start['"]/);
  });
  it('/competitors redirects straight to /home (not /feed?tab which drops the tab)', () => {
    const src = read('competitors/page.tsx');
    expect(src).toMatch(/redirect\(\s*['"]\/home['"]\s*\)/);
    expect(src).not.toMatch(/\/feed\?tab/);
  });
  it.each([
    'feed/hooks/page.tsx',
    'feed/channels/page.tsx',
    'competitors/[handle]/page.tsx',
    'competitors/compare/page.tsx',
  ])('orphan %s redirects to /home (hidden with its parent, no direct-URL leak)', (p) => {
    const src = read(p);
    expect(src).toMatch(/redirect\(\s*['"]\/home['"]\s*\)/);
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
