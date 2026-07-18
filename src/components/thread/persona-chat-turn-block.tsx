'use client';

/**
 * PersonaChatTurnBlockRenderer — one turn of the "Ask them why →" chat-with-persona
 * sub-thread (P9 / LIVE-03, D-03). Persisted as a `persona-chat-turn` typed block in the
 * Read's thread; re-validated through loadMessages on rehydration (D-14).
 *
 * Honesty spine: in-voice SIM-1 text only — no band, no score, no fabricated crowd. The
 * creator's question (role="user") right-aligns muted; the persona's in-voice answer
 * (role="assistant") left-aligns on the flat surface. THEME-06 flat-warm, never coral.
 */

import type { PersonaChatTurnBlock } from '@/lib/tools/blocks';

export function PersonaChatTurnBlockRenderer({ block }: { block: PersonaChatTurnBlock }) {
  const isUser = block.props.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          'max-w-[85%] rounded-[12px] px-3 py-2 text-[14px] leading-snug ' +
          (isUser
            ? 'bg-[var(--color-surface)] text-foreground'
            : 'border border-[var(--color-border)] text-foreground')
        }
      >
        {!isUser && (
          <p className="mb-0.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
            {block.props.archetype}
          </p>
        )}
        <p className="whitespace-pre-wrap">{block.props.text}</p>
      </div>
    </div>
  );
}
