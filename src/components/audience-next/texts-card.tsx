"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

import { Card } from "@/components/ui/card";
import type { AudiencePage, SplitText } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS } from "@/lib/audience-next/audience-words";

/**
 * What works with them / What falls flat (spec 3.2.7): the read's two short texts, each its
 * first sentence and, when there is more, an inline "More" that shows the rest in place and takes the focus
 * to it. A missing text is left out (the screen draws no card with both missing).
 */

const S = AUDIENCE_STRINGS;

/** The focus lands on a text that is not a control: no ring (the app-wide outline is unlayered: inline). */
const NO_RING: CSSProperties = { outline: "none" };

function Text({ heading, text }: { heading: string; text: SplitText }) {
  const headingId = useId();
  const textId = useId();
  const restRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const more = () => {
    flushSync(() => setOpen(true));
    restRef.current?.focus();
  };
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-title font-[650] text-foreground">
        {heading}
      </h2>
      <p id={textId} className="mt-1 break-words text-ui text-foreground-secondary">
        {text.first}
        {text.rest !== null && " "}
        {text.rest !== null &&
          (open ? (
            <span ref={restRef} tabIndex={-1} style={NO_RING}>
              {text.rest}
            </span>
          ) : (
            // Spoken "More, What works with them": two of them sit on the card.
            <button
              type="button"
              aria-expanded={false}
              aria-controls={textId}
              aria-describedby={headingId}
              onClick={more}
              className="font-[620] text-foreground"
            >
              {S.more}
            </button>
          ))}
      </p>
    </section>
  );
}

export function TextsCard({ texts }: { texts: AudiencePage["texts"] }) {
  return (
    <Card className="flex flex-col gap-4 px-4 py-4">
      {texts.works && <Text heading={S.works} text={texts.works} />}
      {texts.flat && <Text heading={S.flat} text={texts.flat} />}
    </Card>
  );
}
