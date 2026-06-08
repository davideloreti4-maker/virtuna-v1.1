import { cn } from "@/lib/utils";

/**
 * NumenLogo — the Numen Machines brand mark.
 *
 * Primary mark "stele": a flat-top monolith whose negative space reads as a
 * lowercase "n" — a lit doorway / standing-stone (numen = a divine presence
 * dwelling in a place). Solid mass, quarter-round shoulders, one clean counter.
 * Drawn as a single `evenodd` path filled with `currentColor`, so it inherits
 * the surrounding text color and the counter shows the background through.
 *
 * Wordmark is Inter (the platform typeface), sentence-case, tight tracking.
 *
 * Usage:
 *   <NumenLogo />                 // mark + "Numen" wordmark
 *   <NumenMark size={24} />       // bare mark (sidebar / favicon)
 *   <NumenLogo wordmark="full" /> // mark + Numen / MACHINES lockup
 *   <NumenLogo wordmark="none" /> // mark only
 */

/** Locked geometry — flat-top stele "n", quarter-round shoulders. */
const MARK_PATH =
  "M32 108 V36 Q32 16 54 16 H66 Q88 16 88 36 V108 Z " +
  "M47 108 V44 Q47 34 56 34 H64 Q73 34 73 44 V108 Z";
const MARK_VIEWBOX = "30 13 60 98";
const MARK_RATIO = 60 / 98; // width / height

/** Kept for backwards-compatible call sites; the mark is now a single design. */
type MarkVariant = "node" | "letter";

type NumenLogoProps = {
  /** Mark height in px. Default 22. */
  size?: number;
  /** Which wordmark to render alongside the mark. Default "numen". */
  wordmark?: "numen" | "full" | "none";
  /** Deprecated — retained for API compatibility, no longer affects output. */
  variant?: MarkVariant;
  /** Extra classes on the root element. */
  className?: string;
};

export function NumenMark({
  size = 22,
  className,
}: {
  size?: number;
  variant?: MarkVariant;
  className?: string;
}) {
  return (
    <svg
      width={size * MARK_RATIO}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path fillRule="evenodd" clipRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}

export function NumenLogo({
  size = 22,
  wordmark = "numen",
  className,
}: NumenLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <NumenMark size={size} className="shrink-0" />
      {wordmark !== "none" && (
        <span className="flex flex-col justify-center leading-none">
          {/* color inherited from parent so each placement controls it */}
          <span className="text-[17px] font-bold tracking-[-0.02em]">
            Numen
          </span>
          {wordmark === "full" && (
            <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.34em] opacity-60">
              Machines
            </span>
          )}
        </span>
      )}
    </span>
  );
}
