/** @vitest-environment happy-dom */
/**
 * Phase 5 follow-up (CHAT-01/02) — the shared chat tail + the pinned composer in
 * follow-up mode. London-style: useExpertChat + navigation + the stream/viewport
 * hooks are mocked so the UX is driven deterministically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ── controllable chat mock ──────────────────────────────────────────────────
const chatSend = vi.fn();
let chatState: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
};
vi.mock('@/hooks/queries/use-expert-chat', () => ({
  useExpertChat: () => ({
    ...chatState,
    send: chatSend,
    stop: vi.fn(),
    clearMessages: vi.fn(),
    loadHistory: vi.fn(),
  }),
}));

// composer's analysis-mode deps (unused in follow-up mode, but it still mounts them)
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start: vi.fn(),
    analysisId: 'sim-1',
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase: 'idle',
    error: null,
    reconnect: vi.fn(),
    filmstrips: {},
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'sim-1' }), // pinned layout
  usePathname: () => '/analyze/sim-1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

import { FollowUpProvider } from '../follow-up-context';
import { FollowUpThread } from '../follow-up-thread';
import { Composer } from '@/components/app/home/composer';

function renderTail() {
  return render(
    <FollowUpProvider analysisId="sim-1">
      <FollowUpThread />
      <Composer />
    </FollowUpProvider>,
  );
}

const input = () =>
  screen.getByPlaceholderText(/ask about this simulation/i) as HTMLInputElement;
const sendBtn = () => screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;

beforeEach(() => {
  chatSend.mockClear();
  chatState = { messages: [], streamingText: '', isStreaming: false, error: null };
  cleanup();
});

describe('Phase 5 — follow-up composer (CHAT-01)', () => {
  it('routes the composer text to "Ask the expert" (not a new analysis)', () => {
    renderTail();
    fireEvent.change(input(), { target: { value: 'Will this go viral?' } });
    expect(sendBtn()).toBeEnabled();
    fireEvent.click(sendBtn());
    expect(chatSend).toHaveBeenCalledWith('Will this go viral?');
  });

  it('disables send on an empty draft', () => {
    renderTail();
    expect(sendBtn()).toBeDisabled();
  });

  it('hides the video-upload "+" control in follow-up mode (text-only follow-up)', () => {
    renderTail();
    expect(screen.queryByLabelText(/upload a video/i)).not.toBeInTheDocument();
  });

  it('renders user + assistant turns from chat history', () => {
    chatState.messages = [
      { role: 'user', content: 'Why this score?' },
      { role: 'assistant', content: 'Your hook is weak in the first second.' },
    ];
    renderTail();
    expect(screen.getByTestId('chat-turn-user')).toHaveTextContent('Why this score?');
    expect(screen.getByTestId('chat-turn-assistant')).toHaveTextContent(
      /hook is weak/i,
    );
  });

  it('shows the streaming assistant turn while a response streams', () => {
    chatState.isStreaming = true;
    chatState.streamingText = 'Thinking through your retention…';
    renderTail();
    expect(screen.getByTestId('chat-turn-assistant')).toHaveTextContent(
      /Thinking through your retention/i,
    );
    // Send is locked while streaming.
    expect(sendBtn()).toBeDisabled();
  });
});

describe('Phase 5 — quick-action chips (CHAT-02)', () => {
  it('seeds a prompt into the composer when a chip is tapped', () => {
    renderTail();
    expect(screen.getByTestId('follow-up-chips')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /why this score/i }));
    // The chip seeds the shared draft → the composer input now holds the prompt.
    expect(input().value).toMatch(/why did this video score/i);
    // It seeds (not sends) — no message goes out until the user submits.
    expect(chatSend).not.toHaveBeenCalled();
  });
});
