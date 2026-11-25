"use client";

/**
 * MatchRow.tsx — how close the cut is to the style it was asked in (Task 13b): one line of five marks, Pace, Captions, Title,
 * Zooms and Look. A filled dot is matched, a half dot near, a hollow dot not, in cream at full, 60 % and 30 % strength: no
 * colour. A mark is a button that opens one line under the row (`lineOf`), one at a time; under it, what the style does that
 * the kit cannot draw.
 */
import { useId, useMemo, useState } from "react";
import { lineOf, marksOf, notInKit, type Field, type Mark, type Verdict } from "./match";

/** What a dot says, for a reader who does not see it. */
const SAID: Record<Verdict, string> = { matched: "as asked", near: "close", not: "not as asked" };

export function MatchRow({ match }: { match: { fields: Field[]; notMatched: string[] } }) {
  const marks = useMemo(() => marksOf(match.fields), [match.fields]);
  const [open, setOpen] = useState<Mark["id"] | null>(null);
  const line = useId();
  const opened = marks.find((mark) => mark.id === open);
  const left = notInKit(match.notMatched);
  if (marks.length === 0 && left === null) return null;

  return (
    <div data-part="match" className="grid gap-1">
      <div role="group" aria-label="How close the cut is to the style" className="-mx-1.5 flex flex-wrap gap-x-1.5">
        {marks.map((mark) => (
          <button
            key={mark.id} type="button" data-verdict={mark.verdict}
            aria-expanded={open === mark.id} aria-controls={line}
            onClick={() => setOpen(open === mark.id ? null : mark.id)}
            className="flex h-8 items-center gap-1.5 rounded-sm px-1.5 text-[13px] text-foreground-secondary hover:text-foreground aria-expanded:text-foreground"
          >
            <Dot verdict={mark.verdict} />
            {mark.label}
            <span className="sr-only">, {SAID[mark.verdict]}</span>
          </button>
        ))}
      </div>
      <p id={line} role="status" hidden={!opened} className="text-[13px] leading-[18px] text-foreground-secondary">
        {opened ? lineOf(opened) : null}
      </p>
      {left ? <p className="text-[13px] leading-[18px] text-foreground-muted">{left}</p> : null}
    </div>
  );
}

/** Filled, half or hollow; cream at full, 60 % and 30 %. */
function Dot({ verdict }: { verdict: Verdict }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className={`size-[9px] flex-none text-foreground ${verdict === "matched" ? "" : verdict === "near" ? "opacity-60" : "opacity-30"}`}>
      {verdict === "matched" ? <circle cx="5" cy="5" r="5" fill="currentColor" /> : <circle cx="5" cy="5" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {verdict === "near" ? <path d="M5 0a5 5 0 0 0 0 10z" fill="currentColor" /> : null}
    </svg>
  );
}
