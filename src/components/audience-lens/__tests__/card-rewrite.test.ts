/**
 * card-rewrite — guards the LIVE-07 Rewrite-loop wiring (09-VERIFICATION GAP 2).
 *
 * The phase-09 verifier found the `rewrite: LensRewrite` prop was supplied by ZERO mount
 * sites, so the sticky "Rewrite for this audience →" CTA never rendered. These tests lock
 * that the per-skill descriptor builder produces a functional rewrite (endpoint sourced
 * from the CHAIN_HANDOFFS self-handoff SSOT, prior counts parsed from the REAL fraction,
 * lever = the audience's real verbatim) — and that `onRewrite` re-POSTs the pinned payload.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCardRewrite } from '../card-rewrite';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildCardRewrite — LIVE-07 descriptor', () => {
  it('builds a rewrite for each regenerable skill with the self-handoff endpoint + parsed priors', () => {
    const idea = buildCardRewrite({
      skill: 'idea',
      fraction: '6/10 stop',
      scrollQuote: 'Lost me at the hook.',
      conceptText: 'Title\n\nAngle',
      platform: 'tiktok',
    });
    expect(idea).toBeDefined();
    expect(idea!.endpoint).toBe('/api/tools/ideas');
    expect(idea!.priorStopCount).toBe(6);
    expect(idea!.priorTotal).toBe(10);
    expect(idea!.lever).toBe('Lost me at the hook.');

    expect(buildCardRewrite({ skill: 'hooks', fraction: '3/10 stop', scrollQuote: 'q', conceptText: 'c', platform: 'tiktok' })!.endpoint).toBe('/api/tools/hooks');
    expect(buildCardRewrite({ skill: 'script', fraction: '4/10 stop', scrollQuote: 'q', conceptText: 'c', platform: 'tiktok' })!.endpoint).toBe('/api/tools/script');
    // remix self-handoff routes to the develop endpoint (A2 minimal adjustment).
    expect(buildCardRewrite({ skill: 'remix', fraction: '5/10 stop', scrollQuote: 'q', conceptText: 'c', platform: 'tiktok', leverRidesAnchor: true })!.endpoint).toBe('/api/tools/ideas/develop');
  });

  it('returns undefined when the fraction is unparseable (no honest prior count to show)', () => {
    expect(
      buildCardRewrite({ skill: 'idea', fraction: 'nope', scrollQuote: 'q', conceptText: 'c', platform: 'tiktok' }),
    ).toBeUndefined();
  });

  it('onRewrite re-POSTs lever as `ask` + concept as `anchor` for ask-accepting runners', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const rw = buildCardRewrite({
      skill: 'hooks',
      fraction: '6/10 stop',
      scrollQuote: 'the lever line',
      conceptText: 'the concept',
      platform: 'instagram',
    })!;
    const result = await rw.onRewrite(rw.lever, rw.platform);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/tools/hooks');
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload).toEqual({ ask: 'the lever line', anchor: 'the concept', platform: 'instagram' });
    // No fabricated delta — the regenerated card streams into the thread instead.
    expect(result).toBeNull();
  });

  it('onRewrite folds the lever INTO the anchor for the remix develop route (anchor-only)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const rw = buildCardRewrite({
      skill: 'remix',
      fraction: '5/10 stop',
      scrollQuote: 'lever',
      conceptText: 'adapted hook',
      platform: 'tiktok',
      leverRidesAnchor: true,
    })!;
    await rw.onRewrite(rw.lever, rw.platform);

    const [, init] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.ask).toBeUndefined();
    expect(payload.anchor).toBe('lever\n\nadapted hook');
    expect(payload.platform).toBe('tiktok');
  });

  it('onRewrite returns null on a non-ok response (no delta, no throw)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const rw = buildCardRewrite({ skill: 'idea', fraction: '6/10 stop', scrollQuote: 'q', conceptText: 'c', platform: 'tiktok' })!;
    await expect(rw.onRewrite(rw.lever, rw.platform)).resolves.toBeNull();
  });
});
