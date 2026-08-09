"use client";

/**
 * The composer's attached SUB-BAR (v8 — owner decision 13, the Claude-Cowork pattern;
 * structurally the shipped mobile sim dock, refined). One hairline strip under the foot,
 * and it is CONTEXT ONLY (the 2026-08-09 rail ruling): persona dots + live dot +
 * "{audience} · {lens} ▾" → the audience sheet. A strip under an input is a
 * status-and-settings idiom — Cowork's `Project · Manual · usage`, Perplexity's foot row —
 * and settings open sheets, never pages.
 *
 * The old right half ("Simulate ›" → the report) died with the ruling: the sim's door is
 * the METER on the card that was simmed (spec §2 — "the verdict is an event, not
 * furniture"), and a second, weaker door earned its keep only when nothing had been
 * simmed, which is a near-empty surface anyway. While a run is in flight the live dot
 * breathes — the strip signals, it does not navigate.
 *
 * The LIVE DOT is the single sanctioned accent on this surface (spec §8).
 */
import { cn } from "@/lib/utils";
import type { Audience } from "@/lib/audience/audience-types";

// Neutral matte washes (the mock's stand-in avatar gradients — no brand color, no accent).
const DOT_WASHES = [
  "linear-gradient(140deg,#5c5245,#3a342c)",
  "linear-gradient(140deg,#4a5158,#30353b)",
  "linear-gradient(140deg,#575060,#38333f)",
];

export function ComposerSubBar({
  audience,
  watching,
  lensLabel,
  onOpenAudience,
}: {
  audience: Audience;
  watching: boolean;
  lensLabel: string;
  onOpenAudience: () => void;
}) {
  const dotCount = Math.min(Math.max(audience.personas?.length ?? 0, 2), 3);
  return (
    <div
      data-testid="composer-sub-bar"
      data-watching={watching || undefined}
      className="flex w-full items-center border-t border-white/[0.06] px-[18px] py-[8px]"
    >
      <button
        type="button"
        aria-label="Choose audience and platform"
        onClick={onOpenAudience}
        className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left text-label text-foreground-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
      >
        <span className="flex shrink-0 items-center">
          {Array.from({ length: dotCount }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="h-4 w-4 rounded-full border-[1.5px] border-background"
              style={{ background: DOT_WASHES[i % DOT_WASHES.length], marginLeft: i ? -6 : 0 }}
            />
          ))}
        </span>
        {/* The single sanctioned accent: the live-presence dot (spec §8, LOCKED). */}
        <span
          data-testid="sub-bar-live-dot"
          aria-hidden
          className={cn(
            "h-[5px] w-[5px] shrink-0 rounded-full bg-accent",
            watching && "motion-safe:animate-pulse",
          )}
        />
        <span className="truncate">
          {audience.name} · {lensLabel}
        </span>
        <span aria-hidden className="shrink-0 text-micro text-foreground-muted">
          ▾
        </span>
      </button>
    </div>
  );
}
