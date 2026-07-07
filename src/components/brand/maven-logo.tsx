import { cn } from "@/lib/utils";

/**
 * MavenLogo — the Maven brand mark (the creator app of Numen Machines).
 *
 * Primary mark: a single gull in flight, drawn as one tapered ink-brush stroke
 * — wings arched up, tips swept out, a soft dip at the body. Monochrome, one
 * closed path filled with `currentColor`, so it inherits the surrounding text
 * color on any ground. Standalone asset lives at `public/brand/maven-mark.svg`.
 *
 * Wordmark is Inter (the platform typeface), sentence-case, tight tracking.
 * "Maven" is the product; the company "Numen Machines" signs the footer.
 *
 * Usage:
 *   <MavenLogo />                 // mark + "Maven" wordmark
 *   <MavenMark size={24} />       // bare mark (sidebar / favicon)
 *   <MavenLogo wordmark="none" /> // mark only
 */

/** Locked geometry — the gull, tapered ink-brush stroke (matches maven-mark.svg). */
const MARK_PATH =
  "M34 66 Q50 30 84 24 Q106 20 120 48 Q134 20 156 24 Q190 30 206 66 " +
  "Q192 38 158 34 Q138 32 120 58 Q102 32 82 34 Q48 38 34 66 Z";
const MARK_VIEWBOX = "0 0 240 96";
const MARK_RATIO = 240 / 96; // width / height

/** Kept for backwards-compatible call sites; the mark is now a single design. */
type MarkVariant = "node" | "letter";

type MavenLogoProps = {
  /** Mark height in px. Default 22. */
  size?: number;
  /** Which wordmark to render alongside the mark. Default "maven". */
  wordmark?: "maven" | "none";
  /** Deprecated — retained for API compatibility, no longer affects output. */
  variant?: MarkVariant;
  /** Extra classes on the root element. */
  className?: string;
};

export function MavenMark({
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
      <path d={MARK_PATH} />
    </svg>
  );
}

export function MavenLogo({
  size = 22,
  wordmark = "maven",
  className,
}: MavenLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <MavenMark size={size} className="shrink-0" />
      {wordmark !== "none" && (
        <span className="flex flex-col justify-center leading-none">
          {/* color inherited from parent so each placement controls it */}
          <span className="text-[17px] font-bold tracking-[-0.02em]">
            Maven
          </span>
        </span>
      )}
    </span>
  );
}
