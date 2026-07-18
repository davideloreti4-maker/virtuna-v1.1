'use client';

/**
 * InputRequestBlockRenderer — the in-thread input affordance the chat agent surfaces when a skill
 * needs structured input the creator's sentence didn't supply (today: Remix needs a video LINK).
 *
 * The agent calls the request_link tool → the chat loop emits an `input-request` block → this
 * renders an inline field RIGHT IN THE THREAD. On submit it runs the named action via the dedicated
 * SSE route (Remix's own 300s budget + real progress stages), which persists the result card to the
 * open thread; then it asks the host to reload (InThreadInputContext.onLinkComplete) so the card
 * appears in-place. No tool-switch, no navigation — the whole exchange stays in one thread.
 *
 * States: idle (field + CTA) → running (live progress spine, field locked) → done (confirmation;
 * the real card is now above via the reload) or error (inline message + the field unlocks to retry).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputRequestBlock } from '@/lib/tools/blocks';
import { usePlatform } from '@/lib/platform-context';
import { useInThreadInput } from '@/lib/in-thread-input-context';
import { useRemixStream } from '@/hooks/queries/use-remix-stream';
import { ProgressChecklist } from './progress-checklist';

export interface InputRequestBlockRendererProps {
  block: InputRequestBlock;
}

export function InputRequestBlockRenderer({ block }: InputRequestBlockRendererProps) {
  const { label, placeholder, platform: blockPlatform } = block.props;
  const ctxPlatform = usePlatform();
  const platform = blockPlatform ?? ctxPlatform;
  const { onLinkComplete } = useInThreadInput();

  const remix = useRemixStream();
  const { start: remixStart, isStreaming, error, isDone, stages } = remix;

  const [url, setUrl] = useState('');
  const completeHandledRef = useRef(false);

  // Derived render states (no effect-driven local state — avoids cascading renders):
  //  - done: a clean completion → the receipt (the real card is now in the thread via the reload).
  //  - isStreaming: the run in progress → the live progress spine.
  //  - otherwise: the idle field (also the retry state after an error).
  const done = isDone && !error;

  // Side-effect ONLY: on a clean completion, reload the host thread ONCE so the persisted card
  // surfaces in-place. Ref-guarded so a re-render can't fire it twice; no setState here.
  useEffect(() => {
    if (isDone && !error && !completeHandledRef.current) {
      completeHandledRef.current = true;
      void onLinkComplete();
    }
  }, [isDone, error, onLinkComplete]);

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed || isStreaming) return;
    completeHandledRef.current = false;
    void remixStart(trimmed, platform);
  }, [url, isStreaming, remixStart, platform]);

  // ── DONE — the card is now in the thread above; leave a quiet receipt in its place ──
  if (done) {
    return (
      <div
        className="rounded-xl border border-white/[0.06] bg-surface-sunken px-4 py-3"
        data-testid="input-request-done"
      >
        <p className="text-[13px] text-foreground-muted">Adapted — your remix is in the thread above.</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-surface-sunken px-4 py-4"
      data-testid="input-request"
    >
      <label htmlFor="in-thread-link" className="text-[13px] font-medium text-foreground-secondary">
        {label}
      </label>

      {/* RUNNING — lock the field and show the real remix progress spine. */}
      {isStreaming ? (
        <div aria-live="polite" aria-atomic="false">
          <ProgressChecklist stages={stages} />
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="in-thread-link"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder ?? 'Paste a link…'}
            className="min-w-0 flex-1 rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="shrink-0 rounded-[8px] bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-default disabled:opacity-40"
          >
            Adapt it →
          </button>
        </div>
      )}

      {error && (
        <p className="text-[12px]" style={{ color: 'var(--color-error)' }} role="alert">
          {remixErrorCopy(error)}
        </p>
      )}
    </div>
  );
}

/** Map the remix SSE error codes to a plain sentence the creator can act on. */
function remixErrorCopy(error: string): string {
  switch (error) {
    case 'resolve_failed':
      return "Couldn't open that link — check it's a public video URL and try again.";
    case 'decode_failed':
      return "Couldn't read that video. Try a different one.";
    case 'adapt_failed':
      return "Couldn't adapt that one — give it another go, or try a different video.";
    default:
      return error || 'Something went wrong — try again.';
  }
}
