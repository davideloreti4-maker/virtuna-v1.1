"use client";

/**
 * Greeting — the one serif voice-moment (Newsreader), the warm human beat of the page.
 * Headline + a proactive line. No accent (the warmth is the serif + cream, not paint).
 */

export function Greeting({ headline, line }: { headline: string; line: string }) {
  return (
    <div className="px-1 pb-1 pt-2">
      <h2 className="m-0 text-balance font-serif text-[27px] font-normal leading-[1.15] tracking-[-0.015em] text-foreground sm:text-[30px]">
        {headline}
      </h2>
      <p className="mt-[9px] text-[12.5px] leading-[1.55] text-foreground-muted">{line}</p>
    </div>
  );
}
