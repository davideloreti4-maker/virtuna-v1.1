'use client';

/**
 * PersonaChatDrawer — the "Ask them why →" chat-with-persona drawer (P9 / LIVE-03, D-03).
 *
 * An in-context drawer over the AudienceLens cloud, scoped to the current Read, ONE persona
 * at a time (switching persona = a new sub-conversation). It:
 *   - POSTs { ask, personaGrounding: { archetype, personaName, reactionToConcept, conceptText } }
 *     to `/api/tools/chat` and streams the in-voice answer token-by-token (reuses the shipped
 *     SSE chat route — no new streaming machinery). `personaName` (The Room, Task A) makes the
 *     viewer answer AS the named person (e.g. "Dev"); grounding + rehydration still key on
 *     `archetype`;
 *   - on open, GETs the prior `persona-chat-turn` turns for THIS archetype from the Read's
 *     thread (sub-thread rehydration — the Q&A re-appears on reopen);
 *   - persists new turns via the route's persona-chat-turn persistence path (Task 2);
 *   - surfaces errors with the shipped SkillRunError look + the verbatim UI-SPEC persona-chat
 *     error copy (no new error UI).
 *
 * `chat` is NOT in the SkillId union (landmine 8) — this is an in-context Read sub-thread, not
 * a top-level skill. Color: flat-matte THEME-06, never coral (UI-SPEC §Color). Under 500 lines.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

export interface PersonaChatTarget {
  /** Registry archetype slug — grounds the in-voice answer + keys sub-thread rehydration. */
  archetype: string;
  /** The persona's real display NAME (The Room, Task A) — e.g. "Dev". What the creator sees + asks. */
  name: string;
  /** Optional slot descriptor for the header subtitle (e.g. "New viewers"). */
  segment?: string;
  /**
   * The persona's verdict + verbatim reaction to THIS concept (from the node).
   * ABSENT = MEET-MODE: the idle "Meet your room" introduction — no concept yet; the persona
   * speaks to its own tastes. The route/runner accept the reaction-less grounding explicitly.
   */
  reactionToConcept?: { verdict: 'stop' | 'scroll'; quote: string };
}

export interface PersonaChatDrawerProps {
  /** The persona being asked — null = drawer closed. */
  target: PersonaChatTarget | null;
  /** The concept text this Read reacted to (grounds the in-voice answer). Omit in meet-mode. */
  conceptText?: string;
  /** Platform for the chat grounding (defaults tiktok). */
  platform?: 'tiktok' | 'instagram' | 'youtube';
  onClose: () => void;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export function PersonaChatDrawer({
  target,
  conceptText = '',
  platform = 'tiktok',
  onClose,
}: PersonaChatDrawerProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  // The last question we attempted to send. Preserved across a failed send so "Retry →"
  // can re-ask it (CR-02): the composer is cleared on send, so without this the retry
  // handler would call send() with an empty ask and silently early-return.
  const [lastQuestion, setLastQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // `archetype` keys GET rehydration + grounding; `speaker` is the named-person display string
  // (The Room, Task A) — falls back to the archetype slug only if a name was somehow omitted.
  const archetype = target?.archetype ?? null;
  const speaker = target?.name ?? archetype ?? null;

  // ── Sub-thread rehydration: load prior turns for THIS archetype on open (D-03) ──
  useEffect(() => {
    if (!archetype) return;
    let cancelled = false;
    setTurns([]);
    setStreaming('');
    setError(null);
    setLastQuestion('');
    (async () => {
      try {
        const res = await fetch(
          `/api/tools/chat?archetype=${encodeURIComponent(archetype)}`,
          { method: 'GET' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { turns?: Turn[] };
        if (!cancelled && Array.isArray(data.turns)) setTurns(data.turns);
      } catch {
        /* non-fatal — drawer still works for new turns */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [archetype]);

  // Keep the latest turn in view as the answer streams.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, streaming]);

  // `override` is supplied by "Retry →" to re-ask the last failed question (CR-02). On a
  // fresh send (no override) we read the composer, clear it, and append the optimistic user
  // turn; on a retry we reuse the preserved question and do NOT clear the composer or append
  // a SECOND user turn (the first attempt already pushed it into `turns`).
  const send = useCallback(
    async (override?: string) => {
      if (!target || isStreaming) return;
      const isRetry = override != null;
      const question = (override ?? ask).trim();
      if (question.length === 0) return;

      setLastQuestion(question);
      setError(null);
      if (!isRetry) {
        setAsk('');
        // Append the optimistic user turn ONLY on a fresh send; the retry re-uses the turn
        // already in `turns` from the failed first attempt (avoids a duplicate user bubble).
        setTurns((prev) => [...prev, { role: 'user', text: question }]);
      }
      setIsStreaming(true);
      setStreaming('');

      let acc = '';
      try {
        const res = await fetch('/api/tools/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ask: question,
            platform,
            // Meet-mode (no reaction) sends NEITHER reaction nor concept — the route's
            // parse would otherwise degrade a partial grounding to open chat (wrong voice).
            personaGrounding: {
              archetype: target.archetype,
              personaName: target.name,
              ...(target.reactionToConcept
                ? { reactionToConcept: target.reactionToConcept, conceptText }
                : {}),
            },
            // Meet-mode with NO open thread runs ephemeral server-side — carry this drawer's
            // in-session transcript so the persona keeps context across turns. `turns` here is
            // the pre-send closure (excludes the current ask); on a retry the failed ask is
            // already in `turns`, so drop that trailing duplicate.
            ...(target.reactionToConcept
              ? {}
              : {
                  priorTurns: (isRetry && turns.length > 0 && turns[turns.length - 1]!.role === 'user'
                    ? turns.slice(0, -1)
                    : turns
                  ).slice(-20),
                }),
          }),
        });
        if (!res.ok || !res.body) throw new Error('request failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamErr: string | null = null;
        let done = false;

        // Parse the SSE frames (event: token|done|error \n data: {…}).
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            // Defensive per-frame parse (WR-03): SSE permits MULTI-LINE `data:` fields and a
            // network chunk can split a frame mid-JSON. Concatenate all `data:` lines, and
            // never let one garbled/keepalive frame throw out of the read loop (which would
            // discard the rest of an otherwise-recoverable stream). Skip on any parse failure.
            try {
              const lines = frame.split('\n');
              const eventLine = lines.find((l) => l.startsWith('event:'));
              const dataLines = lines.filter((l) => l.startsWith('data:'));
              if (!eventLine || dataLines.length === 0) continue;
              const event = eventLine.slice('event:'.length).trim();
              const payload = JSON.parse(dataLines.map((l) => l.slice('data:'.length).trim()).join('\n'));
              if (event === 'token' && typeof payload.delta === 'string') {
                acc += payload.delta;
                setStreaming(acc);
              } else if (event === 'error') {
                streamErr = typeof payload.message === 'string' ? payload.message : 'stream error';
              }
            } catch {
              continue;
            }
          }
        }
        if (streamErr) throw new Error(streamErr);

        // Commit the streamed answer as a persisted turn (route already persisted server-side).
        setTurns((prev) => [...prev, { role: 'assistant', text: acc }]);
        setStreaming('');
      } catch {
        setError(PERSONA_CHAT_ERROR);
        setStreaming('');
      } finally {
        setIsStreaming(false);
      }
    },
    [ask, target, conceptText, platform, isStreaming, turns],
  );

  const open = target !== null;
  // Meet-mode = a target with no reaction (the idle "Meet your room" introduction).
  const meeting = target !== null && !target.reactionToConcept;

  // Esc must close ONLY this drawer. The host surfaces underneath (audience panel, composer
  // room) listen for document-level Esc too — without capture-phase containment one press
  // collapses the entire stack (drawer + panel + room). Capture runs before their bubble
  // listeners: close the drawer here and stop the event cold.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="flex max-h-[80vh] flex-col gap-0 rounded-t-[20px] border-t border-[var(--color-border)] bg-background p-0"
      >
        <SheetTitle className="px-5 pt-5 text-[15px]">
          {speaker ? (meeting ? `Meet ${speaker}` : `Ask ${speaker}`) : 'Ask the audience'}
        </SheetTitle>

        {/* Sub-thread transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {turns.length === 0 && !isStreaming && !error && (
            <p className="py-6 text-center text-[14px] text-foreground-muted">
              {speaker
                ? meeting
                  ? `You're meeting ${speaker} — ask what makes them stop, scroll, or share.`
                  : `Ask ${speaker} why they reacted this way.`
                : ''}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {turns.map((t, i) => (
              <TurnRow key={i} role={t.role} speaker={speaker ?? ''} text={t.text} />
            ))}
            {isStreaming && streaming.length > 0 && (
              <TurnRow role="assistant" speaker={speaker ?? ''} text={streaming} />
            )}
            {isStreaming && streaming.length === 0 && (
              <p className="text-[13px] text-foreground-muted" aria-live="polite">
                {speaker} is thinking…
              </p>
            )}
          </div>

          {error && (
            <div
              className="mt-3 flex flex-col gap-1 rounded-[12px] border border-[var(--color-border)] px-4 py-3"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-[14px]" style={{ color: 'var(--color-cream-secondary)' }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => void send(lastQuestion)}
                disabled={isStreaming || lastQuestion.trim().length === 0}
                className="mt-1 self-start text-[14px] font-medium transition-colors disabled:opacity-40"
                style={{ color: 'var(--color-cream-secondary)' }}
              >
                Retry →
              </button>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="flex items-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <textarea
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={speaker ? `Ask ${speaker}…` : 'Ask…'}
            className="min-h-[42px] flex-1 resize-none rounded-[8px] border border-[var(--color-border)] bg-surface px-3 py-2.5 text-[14px] text-foreground placeholder:text-foreground-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={isStreaming || ask.trim().length === 0}
            className="h-[42px] rounded-[8px] border border-[var(--color-border)] px-4 text-[14px] font-medium text-foreground transition-colors hover:bg-[var(--color-hover)] disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Verbatim UI-SPEC persona-chat error copy (reuses the SkillRunError surface look). */
const PERSONA_CHAT_ERROR =
  "Couldn't reach the audience right now. Your concept is saved — try again in a moment.";

function TurnRow({
  role,
  speaker,
  text,
}: {
  role: 'user' | 'assistant';
  speaker: string;
  text: string;
}) {
  const isUser = role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          'max-w-[85%] rounded-[12px] px-3 py-2 text-[14px] leading-snug ' +
          (isUser
            ? 'bg-surface text-foreground'
            : 'border border-[var(--color-border)] text-foreground')
        }
      >
        {!isUser && speaker && (
          <p className="mb-0.5 text-[11px] uppercase tracking-[0.06em] text-foreground-muted">
            {speaker}
          </p>
        )}
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
