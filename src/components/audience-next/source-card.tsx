"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

import type { ShellIconProps } from "@/components/shell/icons";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import type { AudiencePage } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS } from "@/lib/audience-next/audience-words";
import { cn } from "@/lib/utils";

import { Face, PlatformLine } from "./face";

/**
 * Where the audience came from (spec 3.2.3): the face, the account's handle or the audience's name (two
 * lines at most, a long handle broken inside the card), and its line ("TikTok · read 14 Aug · 12 videos",
 * "Another creator · …", "Described by you"; none when nothing is known). An account's audience that can be
 * read again has a round "Read again" at the right, when the screen is given a handler (the container asks
 * first). A described audience shows its description under it, cut at three lines; "More" (only when the
 * text was cut) shows the rest in place and takes the focus to it.
 */

const S = AUDIENCE_STRINGS;

/** Read again: an arrow round a circle, clockwise (the drawing's round button; 24×24, 1.75, as the shell's glyphs). */
export function ReadAgainIcon(props: ShellIconProps) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.35-5.45L19.5 8.6" />
      <path d="M19.5 4.1v4.5H15" />
    </svg>
  );
}

/** The focus lands on a text that is not a control: no ring (the app-wide outline is unlayered: inline). */
const NO_RING: CSSProperties = { outline: "none" };

function Description({ text, describedBy }: { text: string; describedBy: string }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  // Cut at three lines? Only the browser knows, after layout; again whenever the card's width changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, text]);

  const more = () => {
    flushSync(() => setOpen(true));
    ref.current?.focus();
  };

  return (
    <>
      <p ref={ref} id={id} tabIndex={-1} style={NO_RING} className={cn("mt-2.5 break-words text-ui text-foreground-secondary", !open && "line-clamp-3")}>
        {text}
      </p>
      {!open && cut && (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={id}
          aria-describedby={describedBy}
          onClick={more}
          className="tap-44 mt-1 self-start text-ui font-[620] text-foreground"
        >
          {S.more}
        </button>
      )}
    </>
  );
}

export function SourceCard({ page, onReadAgain }: { page: AudiencePage; onReadAgain?: (from: HTMLElement) => void }) {
  const titleId = useId();
  const { title, line, description } = page.source;
  return (
    <Card className="flex flex-col rounded-[22px] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <Face face={page.face} size={40} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="line-clamp-2 break-words text-title font-[650] text-foreground">
            {title}
          </h2>
          {/* Nothing known about the source (no platform, date or count): no line. */}
          {line !== "" && (
            <p className="text-meta text-foreground-secondary tabular-nums">
              <PlatformLine line={line} platform={page.face.platform} />
            </p>
          )}
        </div>
        {onReadAgain && page.readAgain && (
          <IconButton surface="card" aria-label={S.readAgain} onClick={(e) => onReadAgain(e.currentTarget)}>
            <ReadAgainIcon aria-hidden />
          </IconButton>
        )}
      </div>
      {description && <Description text={description} describedBy={titleId} />}
    </Card>
  );
}
