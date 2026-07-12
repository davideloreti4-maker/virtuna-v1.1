import { cn } from "@/lib/utils";

/**
 * PhoneVideoSkeleton — static shape hint of the TikTok you paste (the INPUT
 * side of the hero showcase). Pure set-dressing in the 03-04 family — NO real
 * data, NO video element, NO network. It depicts the SHAPE of a vertical
 * short-video UI (caption lines, action rail, seek bar) so the hero phone reads
 * as "your video" instead of an empty labelled void, screenshot/video pending
 * (FOUND-03 — swap the whole screen for a real capture later).
 *
 * Composition (9/16 screen, top → bottom):
 *  - a soft charcoal "video" field (a vertical tone ramp — matte, NOT a glow)
 *  - a "Your TikTok" pill top-left (keeps the hero's stable text token)
 *  - right-edge action rail: three cream-muted pips (the like/comment/share
 *    column every vertical-video UI carries)
 *  - bottom caption block: a @handle chip + two text lines
 *  - a hairline seek bar with a small played-portion fill
 *
 * Flat-warm tokens only; coral is NOT used here (A6 — the fold's precious
 * accents stay inside the Simulation window, the OUTPUT). Pure RSC —
 * role="img" + aria-label; internals aria-hidden.
 */
export function PhoneVideoSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Your TikTok (sample)"
      className={cn(
        "relative flex aspect-[9/16] w-full flex-col overflow-hidden bg-surface",
        className
      )}
    >
      {/* the "video" field — a vertical matte tone ramp (cream at whisper alpha
          over charcoal; a tone-step, NOT a glow) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(236,231,222,0.05) 0%, rgba(236,231,222,0.02) 34%, rgba(0,0,0,0.16) 100%)",
        }}
      />

      {/* top row — the "Your TikTok" pill (the hero's stable slot label) */}
      <div className="relative flex items-start p-2.5">
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-[9px] font-medium tracking-wide text-foreground-muted">
          Your TikTok
        </span>
      </div>

      {/* action rail — right edge, three cream-muted pips */}
      <div
        aria-hidden="true"
        className="absolute bottom-[26%] right-2 flex flex-col items-center gap-2.5"
      >
        <span className="h-3 w-3 rounded-full bg-foreground-muted/40" />
        <span className="h-3 w-3 rounded-full bg-foreground-muted/30" />
        <span className="h-3 w-3 rounded-full bg-foreground-muted/25" />
      </div>

      {/* bottom caption block + seek bar */}
      <div aria-hidden="true" className="relative mt-auto flex flex-col gap-1.5 p-2.5 pr-7">
        {/* @handle chip */}
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-foreground-muted/35" />
          <span className="h-1.5 w-1/3 rounded-full bg-foreground-muted/35" />
        </div>
        {/* two caption lines */}
        <span className="h-1.5 w-3/4 rounded-full bg-foreground-muted/20" />
        <span className="h-1.5 w-1/2 rounded-full bg-foreground-muted/15" />
        {/* seek bar — hairline track + a played portion */}
        <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-foreground-muted/20">
          <div className="h-full w-[23%] rounded-full bg-foreground-secondary/70" />
        </div>
      </div>
    </div>
  );
}
