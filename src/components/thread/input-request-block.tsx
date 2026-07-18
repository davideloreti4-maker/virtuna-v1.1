'use client';

/**
 * InputRequestBlockRenderer — the in-thread input affordance the chat agent surfaces when a skill
 * needs something the creator's sentence didn't supply (a video LINK to remix, a concept to read, a
 * niche to explore) or needs nothing typed at all (an account read).
 *
 * The agent calls request_input({ action }) → the chat loop emits an `input-request` block (kind +
 * copy from SKILL_CAPABILITIES) → this renders the matching field RIGHT IN THE THREAD. On submit it
 * runs the named action via that skill's OWN dedicated route (each keeps its budget — remix/account
 * are 300s Apify scrapes; the chat route has no extended budget), which persists the result card to
 * the open thread; then it asks the host to reload (InThreadInputContext.onComplete) so the card
 * appears in-place. No tool-switch, no navigation — the whole exchange stays in one thread.
 *
 * NO model-generated UI: the model only chose the action (+ an optional text prefill it extracted).
 * One sub-component per action, each calling exactly ONE stream hook unconditionally (React rules) —
 * the top-level renderer just picks which to mount from `block.props.action`.
 *
 * States (per field): idle → running (progress/spinner, field locked) → done (receipt; the real card
 * is now above via the reload) or error (inline message + the field unlocks to retry).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputRequestBlock } from '@/lib/tools/blocks';
import { usePlatform } from '@/lib/platform-context';
import { useInThreadInput } from '@/lib/in-thread-input-context';
import { useRemixStream } from '@/hooks/queries/use-remix-stream';
import { useExploreStream } from '@/hooks/queries/use-explore-stream';
import { useAccountReadStream } from '@/hooks/queries/use-account-read-stream';
import { ProgressChecklist } from './progress-checklist';
import { Spinner } from '@/components/ui/spinner';

export interface InputRequestBlockRendererProps {
  block: InputRequestBlock;
}

// ── Shared presentation ────────────────────────────────────────────────────────

const SHELL_CLASS =
  'flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-surface-sunken px-4 py-4';
const INPUT_CLASS =
  'min-w-0 flex-1 rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20';
const CTA_CLASS =
  'shrink-0 rounded-[8px] bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-default disabled:opacity-40';

/** The quiet receipt left in the field's place once the real card is in the thread above. */
function DoneReceipt({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-surface-sunken px-4 py-3"
      data-testid="input-request-done"
    >
      <p className="text-[13px] text-foreground-muted">{text}</p>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="text-[12px]" style={{ color: 'var(--color-error)' }} role="alert">
      {text}
    </p>
  );
}

// ── Top-level switch ─────────────────────────────────────────────────────────────

export function InputRequestBlockRenderer({ block }: InputRequestBlockRendererProps) {
  switch (block.props.action) {
    case 'remix':
      return <RemixField block={block} />;
    case 'explore':
      return <ExploreField block={block} />;
    case 'read':
      return <ReadField block={block} />;
    case 'account':
      return <AccountField block={block} />;
    default:
      return null;
  }
}

// ── Remix (kind: link) ───────────────────────────────────────────────────────────

function RemixField({ block }: InputRequestBlockRendererProps) {
  const { label, placeholder, platform: blockPlatform } = block.props;
  const ctxPlatform = usePlatform();
  const platform = blockPlatform ?? ctxPlatform;
  const { onComplete } = useInThreadInput();

  const { start: remixStart, isStreaming, error, isDone, stages } = useRemixStream();
  const [url, setUrl] = useState('');
  const completeHandledRef = useRef(false);
  const done = isDone && !error;

  useEffect(() => {
    if (isDone && !error && !completeHandledRef.current) {
      completeHandledRef.current = true;
      void onComplete();
    }
  }, [isDone, error, onComplete]);

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed || isStreaming) return;
    completeHandledRef.current = false;
    void remixStart(trimmed, platform);
  }, [url, isStreaming, remixStart, platform]);

  if (done) return <DoneReceipt text="Adapted — your remix is in the thread above." />;

  return (
    <div className={SHELL_CLASS} data-testid="input-request">
      <label htmlFor="in-thread-link" className="text-[13px] font-medium text-foreground-secondary">
        {label}
      </label>
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
            className={INPUT_CLASS}
          />
          <button type="button" onClick={handleSubmit} disabled={!url.trim()} className={CTA_CLASS}>
            Adapt it →
          </button>
        </div>
      )}
      {error && <ErrorLine text={remixErrorCopy(error)} />}
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

// ── Explore (kind: text, niche optional) ─────────────────────────────────────────

function ExploreField({ block }: InputRequestBlockRendererProps) {
  const { label, placeholder, prefill } = block.props;
  const { onComplete } = useInThreadInput();

  const { start: exploreStart, isStreaming, error, isDone, stages } = useExploreStream();
  const [niche, setNiche] = useState(prefill ?? '');
  const completeHandledRef = useRef(false);
  const done = isDone && !error;

  useEffect(() => {
    if (isDone && !error && !completeHandledRef.current) {
      completeHandledRef.current = true;
      void onComplete();
    }
  }, [isDone, error, onComplete]);

  const handleSubmit = useCallback(() => {
    if (isStreaming) return;
    completeHandledRef.current = false;
    // Empty niche is allowed — the route runs an honest un-niched trending pull (CR-01).
    void exploreStart({ niche: niche.trim() || undefined });
  }, [isStreaming, exploreStart, niche]);

  if (done) return <DoneReceipt text="Pulled — the outliers are in the thread above." />;

  return (
    <div className={SHELL_CLASS} data-testid="input-request">
      <label htmlFor="in-thread-explore" className="text-[13px] font-medium text-foreground-secondary">
        {label}
      </label>
      {isStreaming ? (
        <div aria-live="polite" aria-atomic="false">
          <ProgressChecklist stages={stages} />
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="in-thread-explore"
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder ?? 'A niche or a competitor — or leave blank…'}
            className={INPUT_CLASS}
          />
          <button type="button" onClick={handleSubmit} className={CTA_CLASS}>
            Scan it →
          </button>
        </div>
      )}
      {error && <ErrorLine text={error || 'Something went wrong — try again.'} />}
    </div>
  );
}

// ── Read (kind: text, concept required) ──────────────────────────────────────────
// The concept Read route is a single JSON POST (not SSE): it returns { block } and persists it to the
// open thread. So this field runs a plain fetch + a spinner, then reloads on success.

function ReadField({ block }: InputRequestBlockRendererProps) {
  const { label, placeholder, prefill } = block.props;
  const { onComplete } = useInThreadInput();

  const [concept, setConcept] = useState(prefill ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = concept.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/tools/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Read failed' }));
        setError((err as { message?: string; error?: string }).message ?? (err as { error?: string }).error ?? 'Read failed');
        return;
      }
      setDone(true);
      void onComplete();
    } catch {
      setError('Something went wrong — try again.');
    } finally {
      setSubmitting(false);
    }
  }, [concept, submitting, onComplete]);

  if (done) return <DoneReceipt text="Read — your audience's take is in the thread above." />;

  return (
    <div className={SHELL_CLASS} data-testid="input-request">
      <label htmlFor="in-thread-read" className="text-[13px] font-medium text-foreground-secondary">
        {label}
      </label>
      {submitting ? (
        <div className="flex items-center gap-2 text-[13px] text-foreground-muted" aria-live="polite">
          <Spinner size="sm" />
          <span>Reading it past your audience…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            id="in-thread-read"
            rows={3}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={placeholder ?? 'Paste a hook, concept, or draft…'}
            className={`${INPUT_CLASS} resize-none`}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!concept.trim()}
            className={`${CTA_CLASS} self-end`}
          >
            Read it →
          </button>
        </div>
      )}
      {error && <ErrorLine text={error} />}
    </div>
  );
}

// ── Account (kind: none — a confirm-to-run button, no typed input) ────────────────
// The account read resolves the creator's own handle server-side and needs nothing typed. It is a
// paid Apify scrape, so it fires on the button TAP (a real gesture), never on render (D-05). We ask
// the route to persist (persist:true) so the reload surfaces the card in the chat view.

function AccountField({ block }: InputRequestBlockRendererProps) {
  const { label } = block.props;
  const { onComplete } = useInThreadInput();

  const { start, isStreaming, error, fallbackMessage, block: resultBlock } = useAccountReadStream();
  const completeHandledRef = useRef(false);

  // Completion = a real block arrived (a thin-history fallback has no block → nothing to reload).
  // Derived, not stored — no setState in the effect (the effect only fires the one-shot reload).
  const done = !isStreaming && !!resultBlock && !error;
  useEffect(() => {
    if (done && !completeHandledRef.current) {
      completeHandledRef.current = true;
      void onComplete();
    }
  }, [done, onComplete]);

  const handleRun = useCallback(() => {
    if (isStreaming) return;
    completeHandledRef.current = false;
    void start({ persist: true });
  }, [isStreaming, start]);

  if (done) return <DoneReceipt text="Read — your account read is in the thread above." />;

  return (
    <div className={SHELL_CLASS} data-testid="input-request">
      <p className="text-[13px] font-medium text-foreground-secondary">{label}</p>
      {isStreaming ? (
        <div className="flex items-center gap-2 text-[13px] text-foreground-muted" aria-live="polite">
          <Spinner size="sm" />
          <span>Reading your account…</span>
        </div>
      ) : (
        <button type="button" onClick={handleRun} className={`${CTA_CLASS} self-start`}>
          Read my account →
        </button>
      )}
      {/* Thin-history fallback is a calm warning, not a hard error (SELF-02). */}
      {!error && fallbackMessage && (
        <p className="text-[12px] text-foreground-muted" role="status">
          {fallbackMessage}
        </p>
      )}
      {error && <ErrorLine text={error} />}
    </div>
  );
}
