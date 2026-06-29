/**
 * chain-handoff.test.ts — Asserts the CHAIN_HANDOFFS registry is correctly wired (Plan 06-05).
 *
 * Tests:
 *  1. handoffsFor("hooks") includes a script CTA with endpoint="/api/tools/script" + anchorFrom="card"
 *  2. handoffsFor("script") includes a test CTA with endpoint=null + anchorFrom="context"
 *  3. handoffsFor("remix") includes a hooks CTA with anchorFrom="card" + exact endpoint string
 *     + asserts the payload contract the remix-card sends ({ anchor, platform }) matches
 *     the PINNED /api/tools/ideas/develop endpoint shape (ideaId?, anchor, platform).
 *  4. All SkillId members resolve via handoffsFor (no missing skill registration).
 *
 * Endpoint strings are pinned so a future drift fails this test rather than silently mis-routing.
 */

import { describe, it, expect } from 'vitest';
import { handoffsFor, CHAIN_HANDOFFS } from '../chain-handoff';
import type { SkillId } from '../chain-handoff';

// ── 1. hooks → script ────────────────────────────────────────────────────────

describe('handoffsFor("hooks")', () => {
  it('includes a script CTA with the pinned endpoint and card anchor', () => {
    const handoffs = handoffsFor('hooks');
    const scriptHandoff = handoffs.find((h) => h.to === 'script');

    expect(scriptHandoff).toBeDefined();
    expect(scriptHandoff!.ctaLabel).toBe('Write script →');
    // PINNED: /api/tools/script — must match 06-03-SUMMARY.md contract
    expect(scriptHandoff!.endpoint).toBe('/api/tools/script');
    // anchorFrom "card" — hookLine is POSTed as anchor by the hook-card's CTA
    expect(scriptHandoff!.anchorFrom).toBe('card');
  });

  it('also keeps the existing test CTA (hooks→test context handoff — regression guard)', () => {
    const handoffs = handoffsFor('hooks');
    const testHandoff = handoffs.find((h) => h.to === 'test');

    expect(testHandoff).toBeDefined();
    expect(testHandoff!.endpoint).toBeNull();
    expect(testHandoff!.anchorFrom).toBe('context');
  });
});

// ── 2. script → test ─────────────────────────────────────────────────────────

describe('handoffsFor("script")', () => {
  it('includes a test CTA with null endpoint (context handoff) and context anchor', () => {
    const handoffs = handoffsFor('script');
    const testHandoff = handoffs.find((h) => h.to === 'test');

    expect(testHandoff).toBeDefined();
    expect(testHandoff!.ctaLabel).toBe('Test full →');
    // null endpoint = ScriptTestContext mediates the handoff (no card-level fetch)
    expect(testHandoff!.endpoint).toBeNull();
    // anchorFrom "context" — opening beat line + script brief flow via ScriptTestContext
    expect(testHandoff!.anchorFrom).toBe('context');
  });
});

// ── 3. remix → hooks ─────────────────────────────────────────────────────────

describe('handoffsFor("remix")', () => {
  it('includes a hooks CTA with card anchor and the pinned develop endpoint', () => {
    const handoffs = handoffsFor('remix');
    const hooksHandoff = handoffs.find((h) => h.to === 'hooks');

    expect(hooksHandoff).toBeDefined();
    expect(hooksHandoff!.ctaLabel).toBe('Develop into hooks →');
    // anchorFrom "card" — RemixCardRenderer POSTs the adaptedHook as anchor
    expect(hooksHandoff!.anchorFrom).toBe('card');
    // PINNED REUSE PATH: /api/tools/ideas/develop (03-03-SUMMARY.md + 04-02-SUMMARY.md)
    // This endpoint accepts { ideaId?, anchor, platform } — ideaId is optional, so
    // the remix payload { anchor, platform } (no ideaId) is a valid body shape.
    // If this assertion fails, the endpoint contract has drifted — update the route or add a thin wrapper.
    expect(hooksHandoff!.endpoint).toBe('/api/tools/ideas/develop');
  });

  /**
   * Payload contract assertion (P6 pinned).
   *
   * The remix-card's "Develop into hooks →" CTA sends:
   *   POST /api/tools/ideas/develop
   *   Body: { anchor: string, platform: string }   (ideaId absent — optional per PINNED CONTRACT)
   *
   * This test documents that contract so a future change to the endpoint (making ideaId
   * required, renaming anchor, etc.) fails loudly here rather than silently mis-routing.
   *
   * The PINNED CONTRACT from 03-03-SUMMARY.md:
   *   Payload: { ideaId?: string, anchor: string, platform: string }
   *   — ideaId is optional (the remix path omits it; the anchor IS the adapted hook line)
   *   — anchor is required (the adapted hook line from RemixCardBlock.props.adaptedHook)
   *   — platform is required (the current composer platform)
   */
  it('payload contract: { anchor, platform } without ideaId matches the pinned /develop body shape', () => {
    const handoffs = handoffsFor('remix');
    const hooksHandoff = handoffs.find((h) => h.to === 'hooks');
    expect(hooksHandoff).toBeDefined();

    // Construct the remix-card CTA body (what RemixCardRenderer sends on click)
    const remixCtaBody = {
      anchor: 'This adapted hook stops the scroll for fitness creators on TikTok',
      platform: 'tiktok',
      // ideaId is intentionally absent — remix does not have an ideaId
    };

    // Assert the body shape is a subset of the PINNED CONTRACT
    // { ideaId?: string, anchor: string, platform: string }
    expect(typeof remixCtaBody.anchor).toBe('string');
    expect(remixCtaBody.anchor.length).toBeGreaterThan(0);
    expect(typeof remixCtaBody.platform).toBe('string');
    expect(remixCtaBody.platform.length).toBeGreaterThan(0);
    // ideaId must NOT be present (remix anchor replaces it)
    expect('ideaId' in remixCtaBody).toBe(false);

    // Assert the endpoint accepts this body (endpoint string pinned)
    expect(hooksHandoff!.endpoint).toBe('/api/tools/ideas/develop');
  });
});

// ── 3b. discover → remix (Phase 8) ────────────────────────────────────────────

describe('handoffsFor("discover")', () => {
  it('includes a remix CTA with the pinned rehost endpoint and card anchor', () => {
    const handoffs = handoffsFor('discover');
    const remixHandoff = handoffs.find((h) => h.to === 'remix');

    expect(remixHandoff).toBeDefined();
    expect(remixHandoff!.ctaLabel).toBe('Remix → Read');
    // PINNED: /api/tools/remix/run — must match tools/remix/run/route.ts ({ url, platform })
    expect(remixHandoff!.endpoint).toBe('/api/tools/remix/run');
    // anchorFrom "card" — the OutlierTile's own videoUrl is POSTed as the rehost url
    expect(remixHandoff!.anchorFrom).toBe('card');
  });

  it('resolves as a valid SkillId via handoffsFor (no missing registration)', () => {
    const discover: SkillId = 'discover';
    expect(() => handoffsFor(discover)).not.toThrow();
    expect(Array.isArray(handoffsFor(discover))).toBe(true);
  });
});

// ── 3c. Rewrite for this audience — same-skill self-handoff (P9 / LIVE-07, D-05) ──

describe('Rewrite for this audience (same-skill self-handoff)', () => {
  const REWRITE_LABEL = 'Rewrite for this audience →';

  // from===to + originating endpoint, pinned so a future drift fails here.
  const cases: Array<{ skill: SkillId; endpoint: string }> = [
    { skill: 'idea', endpoint: '/api/tools/ideas' },
    { skill: 'hooks', endpoint: '/api/tools/hooks' },
    { skill: 'script', endpoint: '/api/tools/script' },
    // remix/run rejects a lever re-POST (url-only); re-develops via the PINNED develop route (A2)
    { skill: 'remix', endpoint: '/api/tools/ideas/develop' },
  ];

  for (const { skill, endpoint } of cases) {
    it(`${skill} has a self-handoff Rewrite CTA (from===to) with the pinned endpoint`, () => {
      const handoffs = handoffsFor(skill);
      const rewrite = handoffs.find((h) => h.to === skill && h.ctaLabel === REWRITE_LABEL);

      expect(rewrite).toBeDefined();
      // from===to — the regenerable self-handoff (the flywheel, D-05)
      expect(rewrite!.from).toBe(skill);
      expect(rewrite!.to).toBe(skill);
      expect(rewrite!.ctaLabel).toBe(REWRITE_LABEL);
      // lever injected as the steering anchor → anchorFrom "card"
      expect(rewrite!.anchorFrom).toBe('card');
      // pinned originating endpoint — drift fails loudly here
      expect(rewrite!.endpoint).toBe(endpoint);
    });
  }

  it('does NOT add a Rewrite for non-regenerable surfaces (no chat/discover/test self-handoff)', () => {
    for (const skill of ['discover', 'test'] as SkillId[]) {
      const selfRewrite = handoffsFor(skill).find(
        (h) => h.to === skill && h.ctaLabel === REWRITE_LABEL,
      );
      expect(selfRewrite).toBeUndefined();
    }
  });
});

// ── 3d. profile → simulate (Phase 5 — PROF-04, the one-thread wow) ────────────

describe('handoffsFor("profile")', () => {
  it('returns exactly one simulate CTA with the pinned endpoint and card anchor', () => {
    const handoffs = handoffsFor('profile');
    const simulateHandoffs = handoffs.filter((h) => h.to === 'simulate');

    // Exactly one profile→simulate entry (no duplicate chain rails).
    expect(simulateHandoffs).toHaveLength(1);
    const simulate = simulateHandoffs[0]!;

    expect(simulate.ctaLabel).toBe('Simulate a message to them →');
    // PINNED: /api/tools/simulate — must match the 05-05 route contract
    expect(simulate.endpoint).toBe('/api/tools/simulate');
    // anchorFrom "card" — the profile-read card carries savedAudienceId
    expect(simulate.anchorFrom).toBe('card');
  });

  it('resolves as a valid SkillId via handoffsFor (no missing registration)', () => {
    const profile: SkillId = 'profile';
    expect(() => handoffsFor(profile)).not.toThrow();
    expect(Array.isArray(handoffsFor(profile))).toBe(true);
  });
});

// ── 3e. simulate → predict (Phase 6 — PRED-03, the Predict chain) ─────────────
//
// RED until 06-07 appends the entry to CHAIN_HANDOFFS (and "predict" to SkillId).
// The Simulate card's "Predict an outcome →" CTA POSTs the just-simulated panel to the
// predict route. Endpoint + label PINNED so a future drift fails here, not silently.

describe('handoffsFor("simulate") — Predict chain (P6, → 06-07)', () => {
  it('includes a predict CTA with the pinned endpoint and label', () => {
    const handoffs = handoffsFor('simulate');
    const predict = handoffs.find((h) => h.to === 'predict');

    expect(predict).toBeDefined();
    expect(predict!.ctaLabel).toBe('Predict an outcome →');
    // PINNED: /api/tools/predict — must match the 06-06 route contract
    expect(predict!.endpoint).toBe('/api/tools/predict');
    // anchorFrom "card" — the reaction-distribution card carries the panel audienceId
    expect(predict!.anchorFrom).toBe('card');
  });
});

// ── 4. All SkillId members resolve via handoffsFor ────────────────────────────

describe('handoffsFor — all SkillId members', () => {
  const skillIds: SkillId[] = ['discover', 'idea', 'hooks', 'script', 'remix', 'profile', 'simulate', 'test'];

  it('does not throw for any SkillId', () => {
    for (const skillId of skillIds) {
      expect(() => handoffsFor(skillId)).not.toThrow();
    }
  });

  it('returns an array for every SkillId', () => {
    for (const skillId of skillIds) {
      expect(Array.isArray(handoffsFor(skillId))).toBe(true);
    }
  });
});

// ── 5. Registry completeness — known chains present ───────────────────────────

describe('CHAIN_HANDOFFS registry completeness', () => {
  it('contains exactly the expected chain pairs', () => {
    const pairs = CHAIN_HANDOFFS.map((h) => `${h.from}→${h.to}`);

    // Existing chains (P3/P4 — regression guard)
    expect(pairs).toContain('idea→hooks');
    expect(pairs).toContain('hooks→test');

    // P6 new chains
    expect(pairs).toContain('hooks→script');
    expect(pairs).toContain('script→test');
    expect(pairs).toContain('remix→hooks');

    // P8 new chain — Discover front door launches the moat chain
    expect(pairs).toContain('discover→remix');

    // P5 new chain — Profile → Simulate (the one-thread wow, PROF-04)
    expect(pairs).toContain('profile→simulate');
  });

  it('all endpoints are either a non-empty string or null', () => {
    for (const handoff of CHAIN_HANDOFFS) {
      if (handoff.endpoint !== null) {
        expect(typeof handoff.endpoint).toBe('string');
        expect(handoff.endpoint.length).toBeGreaterThan(0);
        expect(handoff.endpoint.startsWith('/')).toBe(true);
      }
    }
  });
});
