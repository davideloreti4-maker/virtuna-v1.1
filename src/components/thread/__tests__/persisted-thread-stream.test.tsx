/** @vitest-environment happy-dom */
/**
 * PersistedThreadStream — the ONE persisted-history renderer (thread-unification Phase 2).
 *
 * These assertions moved here from chat-thread-view.test.tsx when persisted rendering was extracted out
 * of ChatThreadView: history is now owned by this component for EVERY thread (not just chat-agent), so
 * the reload-fidelity locks (question above its own answer, multi-turn attribution, mixed block types,
 * prose without result-card chrome) belong here. ChatThreadView keeps only the live-turn + follow-up
 * tests. The type-completeness of MessageBlocks (video-test-card, account-read, the profile-read family)
 * is proven in message-blocks / registry tests; what THIS locks is the ordered-turn assembly.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistedThreadStream } from '../persisted-thread-stream';

afterEach(cleanup);

// The idea-card renderer mounts the Saved shelf (useQueryClient), so any render including a card
// must sit under a QueryClientProvider.
function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const IDEA_CARD = {
  type: 'idea-card',
  props: {
    title: 'The 5am myth',
    angle: 'contrarian',
    whyItFits: 'your audience distrusts hustle culture',
    mechanism: 'pattern-break',
    seedHook: 'Everyone lied about 5am',
    needsTake: false,
    topic: 'morning routines',
    take: '',
    format: null,
    band: 'Strong',
    fraction: '4/5',
    scored: true,
    scrollQuote: 'Everyone lied to you about 5am',
    model: 'sim1-flash',
  },
};

describe('PersistedThreadStream — ordered-turn reload', () => {
  it('renders nothing when there are no turns', () => {
    const { container } = renderWithClient(<PersistedThreadStream persistedTurns={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('a turn renders its question + its ordered mixed answer (cards + co-pilot line)', () => {
    // A chat-run ideas set shows in the unified stream, with the question above it — any block type via
    // MessageBlocks. This is the whole point: history is type-complete, not partitioned by tool.
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={[
          {
            userTurn: 'give me 3 ideas about morning routines',
            blocks: [
              IDEA_CARD,
              { type: 'markdown', props: { text: "I've generated 3 angles — want hooks?", origin: 'chat-agent' } },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText('give me 3 ideas about morning routines')).toBeTruthy(); // the question bubble
    expect(screen.getByText('The 5am myth')).toBeTruthy(); // the card
    expect(screen.getByText(/want hooks/i)).toBeTruthy(); // the co-pilot line, same thread
  });

  it('MULTI-TURN: each question sits above only its own answer (the reload-fidelity fix)', () => {
    // The bug this locks: a 2-turn thread reloaded as ONE card under the LAST question, dropping the
    // first question and reattaching its answer under the second. Per-turn rendering must keep both
    // questions AND order the first answer before the second question.
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={[
          {
            userTurn: 'what makes a good hook?',
            blocks: [{ type: 'markdown', props: { text: 'A good hook is a specific prediction error.', origin: 'chat-agent' } }],
          },
          {
            userTurn: 'give me 3 ideas about morning routines',
            blocks: [IDEA_CARD],
          },
        ]}
      />,
    );
    expect(screen.getByText('what makes a good hook?')).toBeTruthy();
    expect(screen.getByText('give me 3 ideas about morning routines')).toBeTruthy();
    // Attribution by DOM order: Q1 → its answer → Q2 → its answer.
    const text = document.body.textContent ?? '';
    const iQ1 = text.indexOf('what makes a good hook?');
    const iA1 = text.indexOf('A good hook is a specific prediction error.');
    const iQ2 = text.indexOf('give me 3 ideas about morning routines');
    const iA2 = text.indexOf('The 5am myth');
    expect(iQ1).toBeGreaterThanOrEqual(0);
    expect(iA1).toBeGreaterThan(iQ1);
    expect(iQ2).toBeGreaterThan(iA1);
    expect(iA2).toBeGreaterThan(iQ2);
  });

  it('renders a prose answer WITHOUT the old result-card frame (no "· General" header chrome)', () => {
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={[{ userTurn: 'q', blocks: [{ type: 'markdown', props: { text: 'A clean prose answer.' } }] }]}
      />,
    );
    expect(screen.getByText('A clean prose answer.')).toBeTruthy();
    // The SkillResultCard header rendered "<skill> · <audience>"; the stream must not carry it.
    expect(screen.queryByText(/·\s*General/)).toBeNull();
    expect(screen.queryByText(/Chat\s*·/)).toBeNull();
  });

  it('a leading assistant turn with no question renders no user bubble but keeps its blocks', () => {
    renderWithClient(
      <PersistedThreadStream persistedTurns={[{ userTurn: null, blocks: [IDEA_CARD] }]} />,
    );
    expect(screen.getByText('The 5am myth')).toBeTruthy();
  });
});
