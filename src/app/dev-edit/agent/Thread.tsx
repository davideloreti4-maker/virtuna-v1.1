"use client";

/**
 * Thread.tsx — the conversation (Task 13b): each request with its answer under it, newest last, just above the field. The
 * creator's words sit at the right on a lifted ground; the editor's are plain text at the left, at most four lines until
 * "More". An answer that changed the edit has a quiet "Undo" back to the edit before it; one that changed nothing is a reply
 * like any other, with nothing to undo. While a change is out its request shows at once, with a soft pulse where the answer
 * will be (none with reduced motion).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Turn } from "./session";

const SAY = "text-[15px] leading-[22px] text-foreground";

/** What the editor says, as plain text: four lines, and "More" when there are more. */
export function Say({ text, lead }: { text: string; lead?: string | null }) {
  const words = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const p = words.current;
      if (p && !open) setLong(p.scrollHeight > p.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, open]);

  return (
    <div className="grid justify-items-start gap-1">
      {lead ? <p className="text-[13px] leading-[18px] text-foreground-secondary">{lead}</p> : null}
      <p ref={words} data-part="say" className={`${SAY} ${open ? "" : "line-clamp-4"}`}>
        {text}
      </p>
      {long || open ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-[13px] leading-[18px] text-foreground-muted hover:text-foreground">
          {open ? "Less" : "More"}
        </button>
      ) : null}
    </div>
  );
}

interface Props {
  turns: readonly Turn[];
  /** The request that is out, its answer not yet here. */
  pending: string | null;
  /** Off while a call is out. */
  disabled: boolean;
  onUndo: (turn: number) => void;
}

export function Thread({ turns, pending, disabled, onUndo }: Props) {
  const end = useRef<HTMLLIElement>(null);
  // The newest is brought into view: the request as it is sent, the answer as it comes. The thread's end is set at the foot
  // of what scrolls, less its own margin, which is the room the field takes where it sticks there ("nearest" would leave an
  // answer behind the field: to it, an end that is on the screen is in view).
  useEffect(() => {
    if (turns.length === 0 && pending === null) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    end.current?.scrollIntoView({ block: "end", behavior: still ? "auto" : "smooth" });
  }, [turns.length, pending]);
  if (turns.length === 0 && pending === null) return null;

  return (
    <ol data-part="thread" aria-label="Your changes" className="relative grid gap-5">
      {turns.map((turn, i) => (
        <li key={i} data-changed={turn.answer.changed} className="grid gap-2">
          <Request text={turn.request} />
          <Say text={turn.answer.say} />
          {turn.answer.changed ? (
            <button type="button" disabled={disabled} onClick={() => onUndo(i)} className="justify-self-start text-[13px] leading-[18px] text-foreground-muted hover:text-foreground disabled:opacity-40 disabled:hover:text-foreground-muted">
              Undo
            </button>
          ) : null}
        </li>
      ))}
      {pending !== null ? (
        <li data-pending className="grid gap-2">
          <Request text={pending} />
          <p role="status" className="text-[15px] leading-[22px] text-foreground-muted motion-safe:animate-pulse">
            Making the change…
          </p>
        </li>
      ) : null}
      {/* The thread's end, for bringing the newest into view: out of the flow, clear of the field that sticks on a phone. */}
      <li ref={end} aria-hidden className="absolute bottom-0 left-0 size-px scroll-mb-24" />
    </ol>
  );
}

function Request({ text }: { text: string }) {
  return <p className="max-w-[85%] justify-self-end whitespace-pre-wrap break-words rounded-lg bg-surface-elevated px-3 py-2 text-[15px] leading-[22px] text-foreground">{text}</p>;
}
