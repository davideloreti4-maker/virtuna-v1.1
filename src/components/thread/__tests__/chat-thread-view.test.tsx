/** @vitest-environment happy-dom */
/**
 * ChatThreadView — chat-as-agent render lock (CHAT_AGENT_DISPATCH).
 *
 * The transport (use-chat-stream) and the route (api/tools/chat) are proven elsewhere; what THIS
 * locks is the last link: a dispatched skill's card-block handed to the chat view via
 * streamingCardBlocks actually RENDERS as its real card (through MessageBlocks → the card renderer)
 * in the SAME thread — the whole point of "one thread, all skills". Also locks that a plain chat
 * turn (markdown only, no cards) is unchanged.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatThreadView } from '../chat-thread-view';
import type { MarkdownBlock } from '@/lib/tools/blocks';

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

const baseProps = {
  persistedBlocks: [] as MarkdownBlock[],
  streamingBlocks: [] as MarkdownBlock[],
  isStreaming: false,
  coldStart: false,
  nudgeShown: false,
  error: null,
};

describe('ChatThreadView — chat-as-agent cards', () => {
  it('renders a dispatched skill card inline (streamingCardBlocks → real card renderer)', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        streamingCardBlocks={[IDEA_CARD]}
        streamingBlocks={[{ type: 'markdown', props: { text: 'Made you an angle — want hooks for it?' } }]}
      />,
    );
    // The idea-card face rendered (title + scroll quote), proving MessageBlocks routed the block.
    expect(screen.getByText('The 5am myth')).toBeTruthy();
    // The closing co-pilot line rendered alongside the card.
    expect(screen.getByText(/want hooks for it/i)).toBeTruthy();
  });

  it('while thinking (streaming, no content yet) shows the lightweight typing indicator, not the heavy skeleton', () => {
    renderWithClient(
      <ChatThreadView {...baseProps} isStreaming={true} userTurn="why do hooks matter?" />,
    );
    // The premium inline typing indicator is present (sr-only label + role=status).
    expect(screen.getByText('Thinking…')).toBeTruthy();
    // The old centered constellation skeleton is NOT used in the chat view anymore.
    expect(screen.queryByTestId('thread-loading-skeleton')).toBeNull();
    // The user's question still shows above the thinking state.
    expect(screen.getByText('why do hooks matter?')).toBeTruthy();
  });

  it('renders assistant answers WITHOUT the old result-card frame (no "· General" header chrome)', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        persistedTurns={[{ userTurn: 'q', blocks: [{ type: 'markdown', props: { text: 'A clean prose answer.' } }] }]}
      />,
    );
    expect(screen.getByText('A clean prose answer.')).toBeTruthy();
    // The SkillResultCard header rendered "<skill> · <audience>"; chat answers must no longer carry it.
    expect(screen.queryByText(/·\s*General/)).toBeNull();
    expect(screen.queryByText(/Chat\s*·/)).toBeNull();
  });

  it('plain chat turn (markdown only, no cards) is unchanged', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        streamingBlocks={[{ type: 'markdown', props: { text: 'Post three times a week.' } }]}
      />,
    );
    expect(screen.getByText('Post three times a week.')).toBeTruthy();
    // No idea-card leaked into a plain turn.
    expect(screen.queryByText('The 5am myth')).toBeNull();
  });

  it('unified reload: a turn renders its question + its ordered mixed answer (cards + co-pilot line)', () => {
    // On reload of a chat-agent thread the composer passes ordered TURNS here; each turn is a question
    // plus its own blocks. MessageBlocks renders each block by type, so a chat-run ideas set shows IN
    // the chat view (not the ideas view), with the question above it.
    renderWithClient(
      <ChatThreadView
        {...baseProps}
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

  it('MULTI-TURN reload: each question sits above only its own answer (the reload-fidelity fix)', () => {
    // The bug this locks: a 2-turn thread reloaded as ONE card under the LAST question, dropping the
    // first question and reattaching its answer under the second. Per-turn rendering must keep both
    // questions AND order the first answer before the second question.
    renderWithClient(
      <ChatThreadView
        {...baseProps}
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
    // Both questions survive (the first was previously dropped).
    expect(screen.getByText('what makes a good hook?')).toBeTruthy();
    expect(screen.getByText('give me 3 ideas about morning routines')).toBeTruthy();
    // Attribution by DOM order: Q1 → its answer → Q2 → its answer. The hook explainer must land BEFORE
    // the ideas question, not under it (the misattribution the bug produced).
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

  it('persistedTurns take precedence over markdown-only persistedBlocks when both are present', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        persistedBlocks={[{ type: 'markdown', props: { text: 'markdown-bucket-only' } }] as MarkdownBlock[]}
        persistedTurns={[{ userTurn: 'q', blocks: [IDEA_CARD] }]}
      />,
    );
    // The ordered turns win: the card shows, the markdown-only bucket is not double-rendered.
    expect(screen.getByText('The 5am myth')).toBeTruthy();
    expect(screen.queryByText('markdown-bucket-only')).toBeNull();
  });
});
