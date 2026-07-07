"use client";

/**
 * Greeting — the one serif voice-moment (Newsreader), the warm human beat of the page.
 * Headline + a proactive line. No accent (the warmth is the serif + cream, not paint).
 */

export function Greeting({ headline, line }: { headline: string; line: string }) {
  return (
    <div className="px-1 pt-1">
      <h2 className="m-0 text-balance font-serif text-[34px] font-normal leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[42px]">
        {headline}
      </h2>
      {line && (
        <p className="mt-3 max-w-[48ch] text-[13.5px] leading-[1.5] text-foreground-muted">{line}</p>
      )}
    </div>
  );
}
