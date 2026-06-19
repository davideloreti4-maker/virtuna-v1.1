/** @vitest-environment happy-dom */
/**
 * lens-chat-gate — regression guard for the LIVE-03 wiring gap (09-VERIFICATION GAP 1).
 *
 * The "Ask them why →" persona-chat affordance is gated in AudienceLens on BOTH a
 * `conceptText` AND at least one persona whose `archetype` is a real persona-registry
 * enum (`conceptText && chatList.length > 0`, CR-01). The phase-09 verifier found the
 * chat was unreachable on EVERY surface because no mount site supplied both at once.
 *
 * These tests lock the gate's two arms so the exact gap cannot silently reopen:
 *  - conceptText + registry-enum archetype present  → the "Ask them why →" row mounts.
 *  - conceptText absent (enum still present)         → the row stays gated off (honest).
 *  - enum archetype absent (placeholder viewer_N)    → the row stays gated off (CR-01).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import { ARCHETYPES } from '@/lib/engine/wave3/persona-registry';
import { AudienceLens } from '../AudienceLens';

afterEach(cleanup);

const ENUM = ARCHETYPES[0]; // a genuine registry enum ("high_engager")

/** Flat reactions with a real registry-enum lead persona (chat-groundable). */
function enumReactions(): FlatPersonaReaction[] {
  return [
    { archetype: ENUM, verdict: 'stop', quote: 'This stopped me cold.' },
    { archetype: 'viewer_2', verdict: 'scroll', quote: '' },
    { archetype: 'viewer_3', verdict: 'scroll', quote: '' },
  ];
}

/** Flat reactions with ONLY positional placeholders (no registry enum → not groundable). */
function placeholderReactions(): FlatPersonaReaction[] {
  return [
    { archetype: 'viewer_1', verdict: 'stop', quote: 'This stopped me cold.' },
    { archetype: 'viewer_2', verdict: 'scroll', quote: '' },
  ];
}

describe('AudienceLens — chat gate (LIVE-03 reachability)', () => {
  it('mounts "Ask them why →" when conceptText AND a registry-enum archetype are both present', () => {
    const { queryAllByText } = render(
      <AudienceLens
        heatmap={null}
        simResults={undefined}
        flatPersonas={enumReactions()}
        conceptText={'A concept the room reacted to'}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(queryAllByText('Ask them why →').length).toBeGreaterThan(0);
  });

  it('keeps chat gated OFF when conceptText is absent (even with a registry enum)', () => {
    const { queryAllByText } = render(
      <AudienceLens
        heatmap={null}
        simResults={undefined}
        flatPersonas={enumReactions()}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(queryAllByText('Ask them why →').length).toBe(0);
  });

  it('keeps chat gated OFF when only placeholder (viewer_N) archetypes exist (CR-01)', () => {
    const { queryAllByText } = render(
      <AudienceLens
        heatmap={null}
        simResults={undefined}
        flatPersonas={placeholderReactions()}
        conceptText={'A concept the room reacted to'}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(queryAllByText('Ask them why →').length).toBe(0);
  });
});
