/**
 * profile-read-block.test.ts — the load-bearing chain seam (Warning-1, Plan 05-01 Task 2).
 *
 * The whole SIMU-03 wow hinges on one hop: the profile-read card's `savedAudienceId` must
 * reach the Simulate POST body as `audienceId` (anchorFrom "card"). This is test-enforced
 * via the pure `buildSimulateRequest` helper rather than left to the manual UAT.
 */

import { describe, it, expect } from 'vitest';
import { buildSimulateRequest } from '../profile-read-block';

describe('buildSimulateRequest (the savedAudienceId → audienceId chain seam)', () => {
  it('maps savedAudienceId to the request body audienceId', () => {
    const req = buildSimulateRequest({ savedAudienceId: 'aud_x' }, 'hello');
    expect(req.audienceId).toBe('aud_x');
  });

  it('carries the drafted message through unchanged', () => {
    const req = buildSimulateRequest({ savedAudienceId: 'aud_x' }, 'hello');
    expect(req.message).toBe('hello');
  });

  it('returns exactly the two seam keys (no leakage)', () => {
    const req = buildSimulateRequest({ savedAudienceId: 'aud_marcus_1' }, 'Can you move the deadline?');
    expect(Object.keys(req).sort()).toEqual(['audienceId', 'message']);
    expect(req).toEqual({ audienceId: 'aud_marcus_1', message: 'Can you move the deadline?' });
  });
});
