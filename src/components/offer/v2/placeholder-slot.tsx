/**
 * The dashed box. Deliberately, unmistakably unfinished.
 *
 * The failure mode this component exists to prevent is a placeholder that looks *plausible* —
 * a grey rounded rectangle where a logo goes reads, at a glance, like a logo that failed to
 * load, and a muted card where a testimonial goes reads like a testimonial you haven't scrolled
 * to yet. Either way a reviewer skims past it and the page ships incomplete. So: a dashed
 * border (nothing else on this page is dashed), a mono uppercase label, and the name of the
 * asset that is missing. It should be impossible to mistake for content.
 *
 * It still BREATHES (`mk-slot-breathe`, desynced per index) — an unfilled wall of six static
 * dashed boxes reads as a broken page, where a wall that moves reads as a page under
 * construction. That is also why the count of live loops does not collapse in the sections
 * that are still waiting on assets.
 */

import { cn } from "@/lib/utils";
import { ambientLoop } from "./ambient";
import { PLACEHOLDER_MARKER, type PlaceholderSlot } from "./placeholders";

interface PlaceholderBoxProps {
  slot: PlaceholderSlot;
  /** Index within its family — drives the desynchronised breathe period. */
  index?: number;
  className?: string;
  /** Taller box for testimonial-shaped slots. */
  shape?: "logo" | "card" | "line";
}

export function PlaceholderBox({ slot, index = 0, className, shape = "logo" }: PlaceholderBoxProps) {
  return (
    <div
      data-placeholder={PLACEHOLDER_MARKER}
      data-slot-id={slot.id}
      className={cn(
        "mk-slot-breathe flex flex-col items-center justify-center gap-1.5 rounded-[10px] px-4 text-center",
        shape === "logo" && "h-[52px]",
        shape === "card" && "h-[184px]",
        shape === "line" && "h-[72px]",
        className,
      )}
      style={{
        border: "1px dashed rgba(236,231,222,0.22)",
        background: "rgba(236,231,222,0.015)",
        ...ambientLoop(index, { base: 3.9, spread: 3.4 }),
      }}
    >
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#8a857c]">
        {slot.label}
      </span>
      <span className="text-[11px] leading-snug text-[#6d6961]">{slot.awaiting}</span>
    </div>
  );
}
