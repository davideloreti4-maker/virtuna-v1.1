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
});
