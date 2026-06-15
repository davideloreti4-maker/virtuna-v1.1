/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage } from '@/hooks/queries/use-expert-chat';

// ReadingChat is the persistent follow-up thread (A3). It reuses the board-free
// useExpertChat SSE engine; we mock that hook so the component's OWN behaviour
// (seed chips, composer enable/submit, thread rendering, FRAME-tag stripping) is
// exercised deterministically with no network.
const send = vi.fn();
const stop = vi.fn();
let mockChat: {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
};
vi.mock('@/hooks/queries/use-expert-chat', () => ({
  useExpertChat: () => ({ ...mockChat, send, stop, clearMessages: vi.fn(), loadHistory: vi.fn() }),
}));

import { ReadingChat } from '../reading-chat';

beforeEach(() => {
  send.mockReset();
  stop.mockReset();
  mockChat = { messages: [], streamingText: '', isStreaming: false, error: null };
});

describe('ReadingChat — persistent follow-up thread (A3)', () => {
  it('empty thread: shows seed chips + a disabled send, and a seed click sends it', async () => {
    const user = userEvent.setup();
    render(<ReadingChat analysisId="sim-1" />);

    // Composer is always present (the whole point: it never disappears).
    expect(screen.getByRole('textbox', { name: /ask about this simulation/i })).toBeInTheDocument();

    const seeds = screen.getByTestId('reading-chat-seeds');
    await user.click(within(seeds).getByText('Why do viewers drop off?'));
    expect(send).toHaveBeenCalledWith('Why do viewers drop off?');
  });

  it('typing then Enter sends the message and clears the field', async () => {
    const user = userEvent.setup();
    render(<ReadingChat analysisId="sim-1" />);

    const box = screen.getByRole('textbox', { name: /ask about this simulation/i });
    await user.type(box, 'how do I fix the hook?');
    await user.keyboard('{Enter}');

    expect(send).toHaveBeenCalledWith('how do I fix the hook?');
    expect((box as HTMLTextAreaElement).value).toBe('');
  });

  it('renders the conversation and strips the internal FRAME: directive from answers', () => {
    mockChat = {
      messages: [
        { role: 'user', content: 'why?' },
        { role: 'assistant', content: 'Because the hook is weak.\nFRAME:Audience' },
      ],
      streamingText: '',
      isStreaming: false,
      error: null,
    };
    render(<ReadingChat analysisId="sim-1" />);

    const thread = screen.getByTestId('reading-chat-thread');
    expect(within(thread).getByText('why?')).toBeInTheDocument();
    expect(within(thread).getByText(/Because the hook is weak\./)).toBeInTheDocument();
    // The machine directive must never render as visible text.
    expect(within(thread).queryByText(/FRAME:Audience/)).not.toBeInTheDocument();
    // Seed chips are gone once a thread exists.
    expect(screen.queryByTestId('reading-chat-seeds')).not.toBeInTheDocument();
  });

  it('while streaming, the composer offers Stop instead of Send', () => {
    mockChat = { messages: [{ role: 'user', content: 'why?' }], streamingText: 'Because…', isStreaming: true, error: null };
    render(<ReadingChat analysisId="sim-1" />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^send$/i })).not.toBeInTheDocument();
  });
});
