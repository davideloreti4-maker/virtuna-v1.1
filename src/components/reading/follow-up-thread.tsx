'use client';

import { cn } from '@/lib/utils';
import { useFollowUp } from './follow-up-context';

/**
 * FollowUpThread (Phase 5, CHAT-01/02) — the Q&A tail that renders inline BELOW
 * the Reading, in the same 760px thread column. There is NO separate chat dock:
 * the bottom-pinned composer is the input (see ReadingThread), and answers append
 * here as plain turns.
 *
 * Quick-action chips (CHAT-02) seed a follow-up prompt into the composer (via the
 * shared draft) — the user can edit before sending. They stay visible so they're
 * always a tap away.
 *
 * Flat-warm: charcoal surfaces, cream text, hairline borders, coral reserved for
 * the lone user-turn accent. No glass/glow (matte taste bar).
 */
const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Why this score?', prompt: 'Why did this video score the way it did?' },
  { label: 'Rewrite my hook', prompt: 'Rewrite my hook to be stronger.' },
  { label: 'How do I fix retention?', prompt: 'How do I fix where viewers drop off?' },
];

export function FollowUpThread() {
  const fu = useFollowUp();
  if (!fu) return null;

  const { messages, streamingText, isStreaming, error, setDraft } = fu;
  const hasTurns = messages.length > 0 || isStreaming;

  return (
    <div
      data-testid="follow-up-thread"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 pb-8"
    >
      {/* divider between the Reading and its follow-up conversation */}
      <div className="border-t border-white/[0.06] pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
          Ask about this simulation
        </p>
      </div>

      {/* quick-action chips — seed the composer (CHAT-02) */}
      <div data-testid="follow-up-chips" className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            type="button"
            onClick={() => setDraft(qa.prompt)}
            className={cn(
              'rounded-full border border-white/[0.06] bg-surface-elevated px-3 py-1.5',
              'text-[13px] text-foreground-secondary transition-colors',
              'hover:bg-white/[0.05] hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* conversation turns */}
      {hasTurns && (
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <ChatTurn key={i} role={m.role} content={m.content} />
          ))}
          {isStreaming && (
            <ChatTurn role="assistant" content={streamingText || '…'} streaming />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

FollowUpThread.displayName = 'FollowUpThread';

function ChatTurn({
  role,
  content,
  streaming,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        data-testid={`chat-turn-${role}`}
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          isUser
            ? 'bg-accent text-accent-foreground'
            : 'border border-white/[0.06] bg-surface-elevated text-foreground',
          streaming && 'text-foreground-secondary',
        )}
      >
        {content}
      </div>
    </div>
  );
}
