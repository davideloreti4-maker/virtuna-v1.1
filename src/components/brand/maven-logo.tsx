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
 * point at the bottom. Same 2.5:1 box, so no call site changes. Its standalone assets are
 * `public/brand/next-icon.svg`, `next-apple-icon.svg`, `maven-mark-next.svg` and `next-og-card.tsx`,
 * picked by the flag; regenerate them with this path (brand-assets.test.ts checks).
 *
 * Wordmark is Inter (the platform typeface), sentence-case, tight tracking. New look: `MavenLogo`
 * draws the lockup (`NextLockup`), a heavier wordmark set against the mark's ink.
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
 * New-look geometry (heavier redraw 2026-11-26: the 2026-11-19 stroke read as a hairline at sidebar
 * size). One closed path, mirrored on x = 120: bottom point (120, 135.2), notch (120, 63.3), wing
 * tips (10, 28) and (230, 28). Built from a cubic centre line per wing, (120,98) (142,70) (170,40)
 * (230,28), with a thickness of 46 at the body tapering as 1 - t^2.6 to a point at the tip, so the
 * wings stay full for most of their length; the body is the lower edges run on to the centre line.
 * Fitted with Catmull-Rom cubics on the right wing; the left is that half mirrored and run backwards,
 * so the two are exact mirrors. Regenerate rather than hand-edit.
 * Exported for Earn's saved share card, which draws the same mark on a canvas.
 */
export const MARK_PATH_NEXT =
  "M120 135.2 L138.1 112.2 C139.2 110.9 142.3 106.8 144.4 104.2 " +
  "C146.5 101.6 148.7 99 150.9 96.4 C153.1 93.8 155.2 91.1 157.5 88.5 C159.8 85.9 162.1 83.3 164.5 80.6 " +
  "C166.9 77.9 169.4 75.3 172 72.6 C174.7 69.9 177.4 67 180.4 64.2 C183.4 61.4 186.5 58.5 190 55.6 " +
  "C193.5 52.7 197.1 49.7 201.2 46.7 C205.3 43.7 209.6 40.5 214.4 37.4 C219.2 34.3 227.4 29.6 230 28 " +
  "C226.9 27.8 217.4 26.9 211.4 26.8 C205.4 26.8 199.6 27.1 194 27.7 C188.4 28.3 183.1 29.3 177.9 30.6 " +
  "C172.7 31.9 167.7 33.5 163 35.3 C158.3 37.1 153.8 39.2 149.5 41.4 C145.2 43.7 141.2 46.2 137.4 48.8 " +
  "C133.6 51.4 129.3 55 126.7 57.1 C124.1 59.2 122.7 60.7 121.9 61.4 L120 63.3 " +
  "L118.1 61.4 C117.3 60.7 115.9 59.2 113.3 57.1 C110.7 55 106.4 51.4 102.6 48.8 " +
  "C98.8 46.2 94.8 43.7 90.5 41.4 C86.2 39.2 81.7 37.1 77 35.3 C72.3 33.5 67.3 31.9 62.1 30.6 " +
  "C56.9 29.3 51.6 28.3 46 27.7 C40.4 27.1 34.6 26.8 28.6 26.8 C22.6 26.9 13.1 27.8 10 28 " +
  "C12.6 29.6 20.8 34.3 25.6 37.4 C30.4 40.5 34.7 43.7 38.8 46.7 C42.9 49.7 46.5 52.7 50 55.6 " +
  "C53.5 58.5 56.6 61.4 59.6 64.2 C62.6 67 65.3 69.9 68 72.6 C70.6 75.3 73.1 77.9 75.5 80.6 " +
  "C77.9 83.3 80.2 85.9 82.5 88.5 C84.8 91.1 86.9 93.8 89.1 96.4 C91.3 99 93.5 101.6 95.6 104.2 " +
  "C97.7 106.8 100.8 110.9 101.9 112.2 Z";
/** 300 x 120 around the 220 x 108 mark: the same 2.5:1 box as the legacy mark. */
export const MARK_VIEWBOX_NEXT = "-30 21 300 120";
/** The mark alone, 1 unit of air round it: the lockup sets the wordmark against the ink, not the box. */
const MARK_VIEWBOX_NEXT_TIGHT = "9 25.8 222 110.4";
const MARK_TIGHT_RATIO = 222 / 110.4; // width / height
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

/**
 * The new-look lockup: the mark against the ink (its tight box), then "Maven". Sized off the mark's
 * height: the wordmark's cap height sits at ~80% of the mark's, so the two read as one weight. The
 * wordmark is Inter at 680 with display tracking (-0.04em); it inherits its colour, the mark is coral.
 */
function NextLockup({ size, wordmark, className }: { size: number; wordmark: "maven" | "none"; className?: string }) {
  const markHeight = size * 0.92;
  return (
    <span className={cn("flex items-center", className)} style={{ gap: Math.round(size * 0.42) }}>
      <svg
        width={markHeight * MARK_TIGHT_RATIO}
        height={markHeight}
        viewBox={MARK_VIEWBOX_NEXT_TIGHT}
        fill="currentColor"
        className="shrink-0 text-[var(--color-accent)]"
        aria-hidden="true"
      >
        <path d={MARK_PATH_NEXT} />
      </svg>
      {wordmark !== "none" && (
        <span
          className="font-[680] leading-none tracking-[-0.04em]"
          style={{ fontSize: Math.round(size * 1.12) }}
        >
          Maven
        </span>
      )}
    </span>
  );
}

export function MavenLogo({
  size = 22,
  wordmark = "maven",
  className,
}: MavenLogoProps) {
  if (NEW_LOOK_ENABLED) return <NextLockup size={size} wordmark={wordmark} className={className} />;
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
