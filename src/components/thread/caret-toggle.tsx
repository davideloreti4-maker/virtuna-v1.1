import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface CaretToggleProps {
  /** Whether the disclosure it controls is open. */
  open: boolean;
  /** Glyph size in px — scale to the surrounding label (12 for small meta rows, 13 default). */
  size?: number;
  /** Extra classes (e.g. a color override to keep the caret muted). */
  className?: string;
}

/**
 * CaretToggle — the disclosure affordance for expand/collapse buttons across the thread cards.
 * A phosphor down-caret that rotates 180° (points up) when open. Inherits currentColor and sits
 * inline with adjacent label text. Replaces the ad-hoc unicode ↑/↓ glyphs that read low-fi and
 * varied per card, giving every card the same crisp, consistent toggle. Motion is a 150ms
 * transform (design-system `--duration-fast`), so it degrades cleanly under reduced-motion.
 */
export function CaretToggle({ open, size = 13, className }: CaretToggleProps) {
  return (
    <CaretDown
      size={size}
      weight="bold"
      aria-hidden="true"
      className={cn("shrink-0 transition-transform duration-150", open && "rotate-180", className)}
    />
  );
}
