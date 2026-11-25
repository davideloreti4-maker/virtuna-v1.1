import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { cn } from "@/lib/utils";

/**
 * MavenLogo — the Maven brand mark (the creator app of Numen Machines).
 *
 * Primary mark: a single gull in flight, drawn as one tapered ink-brush stroke
 * — wings arched up, tips swept out, a soft dip at the body. Monochrome, one
 * closed path filled with `currentColor`, so it inherits the surrounding text
 * color on any ground. Standalone asset lives at `public/brand/maven-mark.svg`.
 *
 * New look (`NEXT_PUBLIC_NEW_LOOK`): the mark is redrawn (owner pick 2026-11-19): a deep V with
 * the wings swept out and up, still one tapered brush stroke, symmetric, closing in a single
 * point at the bottom. Same 2.5:1 box, so no call site changes. The standalone assets
 * (`public/brand/*.svg`, `src/app/icon.svg`, `apple-icon.svg`) switch at cut-over.
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

/**
 * New-look geometry. One closed path, mirrored on x = 120: bottom point (120, 131.1), notch
 * (120, 77.8), wing tips (8, 24) and (232, 24). Generated from a centre line and a taper, then
 * fitted with cubics (max deviation 0.09 units); regenerate rather than hand-edit.
 * Exported for Earn's saved share card, which draws the same mark on a canvas.
 */
export const MARK_PATH_NEXT =
  "M120 131.1 L129.6 109.2 C133.5 100.3 137.1 91.2 140.7 82.7 " +
  "C144.4 74.2 148.3 66.1 153.1 60.4 C156.2 55.4 160.6 51.7 166.6 48.2 " +
  "C171.8 45.2 177.6 42.6 183.6 40.3 C188.8 38.3 194 36.5 199.4 34.8 " +
  "C203.7 33.3 208.1 32 212.5 30.6 C215.9 29.5 219.3 28.4 222.7 27.3 " +
  "C224.9 26.6 227.1 25.8 229.3 25 C230.2 24.7 231.1 24.4 232 24 " +
  "C231.6 24 231.2 24 230.7 24 C229.7 24.1 228.7 24.2 227.6 24.2 " +
  "C226 24.3 224.5 24.4 222.9 24.5 C220.9 24.7 218.8 24.8 216.8 25 " +
  "C214.3 25.1 211.8 25.3 209.3 25.5 C206.3 25.7 203.4 26 200.4 26.2 " +
  "C197 26.5 193.7 26.8 190.3 27.2 C186.5 27.7 182.6 28.2 178.8 28.8 " +
  "C174.5 29.5 170.3 30.4 166 31.5 C161.3 32.7 156.5 34.2 151.7 36.5 " +
  "C146.5 38.9 141.1 42.7 136.9 46.9 C132.7 52 129.7 57.3 127 62.4 " +
  "C124.4 67.6 122.1 72.8 120 77.8 C117.9 72.8 115.6 67.6 113 62.4 " +
  "C110.3 57.3 107.3 52 103.1 46.9 C98.9 42.7 93.5 38.9 88.3 36.5 " +
  "C83.5 34.2 78.7 32.7 74 31.5 C69.7 30.4 65.5 29.5 61.2 28.8 " +
  "C57.4 28.2 53.5 27.7 49.7 27.2 C46.3 26.8 43 26.5 39.6 26.2 C36.6 26 33.7 25.7 30.7 25.5 " +
  "C28.2 25.3 25.7 25.1 23.2 25 C21.2 24.8 19.1 24.7 17.1 24.5 C15.5 24.4 14 24.3 12.4 24.2 " +
  "C11.3 24.2 10.3 24.1 9.3 24 C8.8 24 8.4 24 8 24 C8.9 24.4 9.8 24.7 10.7 25 " +
  "C12.9 25.8 15.1 26.6 17.3 27.3 C20.7 28.4 24.1 29.5 27.5 30.6 " +
  "C31.9 32 36.3 33.3 40.6 34.8 C46 36.5 51.2 38.3 56.4 40.3 C62.4 42.6 68.2 45.2 73.4 48.2 " +
  "C79.4 51.7 83.8 55.4 86.9 60.4 C91.7 66.1 95.6 74.2 99.3 82.7 " +
  "C102.9 91.2 106.5 100.3 110.4 109.2 Z";
/** 300 x 120 around the 224 x 107 mark: the same 2.5:1 box as the legacy mark. */
export const MARK_VIEWBOX_NEXT = "-30 18 300 120";
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
      viewBox={NEW_LOOK_ENABLED ? MARK_VIEWBOX_NEXT : MARK_VIEWBOX}
      fill="currentColor"
      className={cn("text-[var(--color-accent)]", className)}
      aria-hidden="true"
    >
      <path d={NEW_LOOK_ENABLED ? MARK_PATH_NEXT : MARK_PATH} />
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
