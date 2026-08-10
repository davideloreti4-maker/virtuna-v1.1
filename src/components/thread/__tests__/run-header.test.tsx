/** @vitest-environment happy-dom */
/**
 * The `run-header` block — the turn's run stamp, and the thing that makes a RELOADED turn identical
 * to the live one.
 *
 * WHAT WAS BROKEN. Three things about a completed run lived only in client memory: the INTRO
 * (derived from the armed tool + live audience), the RECEIPT (derived from ephemeral SSE stage
 * events, never persisted), and the run's INPUTS (which audience, which platform, which input
 * hook — not inferable from the cards at all). The outro text DID survive, which is what made the
 * gap easy to miss: a reloaded turn came back with words, just not the ones saying what had run
 * and for whom.
 *
 * THE NAMESPACE LOCK is the important half. `skill` here is the DISPLAY namespace — ChatTurnKind /
 * SKILL_RUN_META / STAGE_PLANS keys, i.e. "ideas" PLURAL — never the composer `ToolId` ("idea",
 * singular). The two differ in exactly this one id, and a cast between them CANNOT FAIL at compile
 * time. That is precisely how F-017 shipped: a Start tile armed `ideas`, no branch matched, and
 * the fall-through was the paid SIM-1 Max video Test. tsc will not catch the next one either —
 * this will.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { validateBlock } from '@/lib/tools/block-registry';
import { runHeaderBlock } from '@/lib/tools/run-header';
import { classifyTurn, followupsForKind, type ChatTurnKind } from '@/lib/tools/chat-followups';
import { ThreadTurn } from '../thread-turn';

afterEach(cleanup);

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/** Every route that stamps a run, and the skill id it stamps. */
const STAMPING_ROUTES = [
  'src/app/api/tools/hooks/route.ts',
  'src/app/api/tools/ideas/route.ts',
  'src/app/api/tools/script/route.ts',
  'src/app/api/tools/explore/route.ts',
  'src/app/api/tools/test/card/route.ts',
  'src/app/api/account-read/route.ts',
];

/** Valid display-namespace ids — the union `ChatTurnKind` accepts. */
const VALID_KINDS: ChatTurnKind[] = [
  'chat',
  'ideas',
  'hooks',
  'script',
  'remix',
  'explore',
  'account',
  'test',
  'predict',
  'profile',
];

describe('run-header — registry round-trip', () => {
  it('validates through the block registry (so insertMessage will accept it)', () => {
    // insertMessage re-validates every block at the WRITE boundary and THROWS on a miss, so a
    // schema that did not round-trip would fail the whole run, not just the stamp.
    const result = validateBlock(
      runHeaderBlock({ skill: 'hooks', audienceLabel: 'Bootstrapped Founders', platform: 'tiktok' }),
    );
    expect(result.ok).toBe(true);
  });

  it('omits fields it does not know rather than defaulting them', () => {
    // A stamp that guessed "General" would be indistinguishable from one that knew.
    const block = runHeaderBlock({ skill: 'account' });
    expect(block.props).toEqual({ skill: 'account' });
    expect(validateBlock(block).ok).toBe(true);
  });
});

describe('run-header — THE NAMESPACE LOCK (F-017)', () => {
  it.each(STAMPING_ROUTES)('%s stamps a valid DISPLAY-namespace skill id', (path) => {
    const src = readFileSync(path, 'utf8');
    const stamped = [...src.matchAll(/runHeaderBlock\(\{\s*skill:\s*"([^"]+)"/g)].map((m) => m[1]!);

    expect(stamped.length, `${path} calls runHeaderBlock but stamps no literal skill`).toBeGreaterThan(0);
    for (const skill of stamped) {
      // The singular ToolId spellings are the trap. "idea" is a valid ToolId and an INVALID kind.
      expect(VALID_KINDS, `${path} stamps "${skill}" — not a ChatTurnKind`).toContain(skill);
    }
  });

  it('the trap id itself is rejected — "idea" (ToolId) is not a turn kind', () => {
    expect(VALID_KINDS).not.toContain('idea' as ChatTurnKind);
    // …and the two namespaces really do differ in exactly this one id, which is why a cast is silent.
    expect(VALID_KINDS).toContain('ideas');
  });

  it('every stamped id resolves to real follow-ups (a stamp nothing consumes is dead)', () => {
    for (const path of STAMPING_ROUTES) {
      const src = readFileSync(path, 'utf8');
      for (const m of src.matchAll(/runHeaderBlock\(\{\s*skill:\s*"([^"]+)"/g)) {
        expect(followupsForKind(m[1]! as ChatTurnKind).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('run-header — a RELOADED turn renders like the live one', () => {
  const HOOK_CARD = {
    type: 'hook-card',
    props: {
      hookLine: 'Stop posting at 9am',
      audienceArchetype: 'The Skeptic',
      mechanism: 'breaks the expected pattern',
      seedHook: 'Stop posting at 9am',
      rank: 1,
      band: 'Strong',
      fraction: '8/10 stop',
      scrollQuote: 'wait, what?',
      model: 'sim1-flash',
      scored: true,
      channel: 'spoken',
    },
  };

  /** Exactly what comes back from the database for a completed hooks run. */
  const persistedTurn = [
    runHeaderBlock({ skill: 'hooks', audienceLabel: 'Bootstrapped Founders', platform: 'tiktok' }),
    HOOK_CARD,
    { type: 'markdown', props: { text: '#1 is your strongest — want a script from it?' } },
  ];

  it('rebuilds the INTRO, naming the audience the run actually used', () => {
    renderWithClient(<ThreadTurn userTurn="give me hooks" blocks={persistedTurn} />);
    // Without the stamp this said "for General" — the skill was inferable from the cards, the
    // audience was not.
    expect(screen.getByLabelText(/Pulled hooks for Bootstrapped Founders/)).toBeTruthy();
  });

  it('the reloaded intro is PAST tense — it no longer claims a finished run is in flight', () => {
    // The intro used to be suppressed on rehydrate precisely because it is written in the present
    // ("Pulling hooks for X…"). Now that it PERSISTS, tense is the thing that keeps it honest: the
    // same line above already-rendered cards would otherwise announce a run that finished
    // yesterday. The live branch keeps the present tense (see chat-turn.test.tsx).
    renderWithClient(<ThreadTurn userTurn="give me hooks" blocks={persistedTurn} />);
    expect(screen.queryByLabelText(/Pulling hooks/)).toBeNull();
  });

  it('rebuilds the RECEIPT from the skill’s canonical plan (stage events are never persisted)', () => {
    renderWithClient(<ThreadTurn userTurn="give me hooks" blocks={persistedTurn} />);
    expect(screen.getByText('Ran your audience')).toBeTruthy();
    expect(screen.getByText('3 steps')).toBeTruthy();
  });

  it('renders the closing line as the OUTRO, not as a stray markdown block among the cards', () => {
    renderWithClient(<ThreadTurn userTurn="give me hooks" blocks={persistedTurn} />);
    expect(screen.getByText('#1 is your strongest — want a script from it?')).toBeTruthy();
    // …and the skill's follow-up pills ride with it.
    expect(screen.getByTestId('followup-row')).toBeTruthy();
  });

  it('a LEGACY turn (no stamp) still gets its intro + receipt, inferred from block types', () => {
    // Pre-existing threads carry no stamp. Inference is what makes this change need no backfill
    // migration — the audience falls back, but the turn is not a bare card dump.
    // Stage A: the fallback is the honest neutral 'your audience', never 'General' — that is
    // the NAME of a real audience, so guessing it was indistinguishable from knowing it (F-3).
    expect(classifyTurn(['hook-card'])).toBe('hooks');
    renderWithClient(<ThreadTurn userTurn="give me hooks" blocks={[HOOK_CARD]} />);
    expect(screen.getByText('Ran your audience')).toBeTruthy();
    expect(screen.getByLabelText(/Pulled hooks for your audience/)).toBeTruthy();
  });
});
