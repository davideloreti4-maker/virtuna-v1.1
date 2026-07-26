/**
 * ProductShot — how a real product screenshot is presented below the hero.
 *
 * The shots in `public/images/offer/` are photographs of the SHIPPED surfaces
 * (see `scripts/capture-offer-shots.ts`). This frames them the same way the hero
 * frames the live card — hairline border, dark drop, matte ground — so the page
 * reads as one set instead of "hero product + marketing images".
 *
 * Why static images and not the live components: the hero already pays for two
 * heavy client islands. Repeating that per section would put the composer, the
 * room and the card on a cold mobile page whose entire job is a fast first
 * impression. These are plain images — real pixels, no hydration.
 *
 * Presentation choices that matter:
 *  • `edge="fade"` bottom-fades a crop so a deliberately-cut surface reads as
 *    "there's more below", not as a truncation bug.
 *  • `chrome` adds the hero's browser bar for surfaces that ARE the app; a bare
 *    frame suits a component-level crop.
 *  • Every shot declares intrinsic width/height, so nothing shifts on load.
 *
 * Deliberately NOT a client module: RSC sections import `SHOTS` from here, and a
 * `"use client"` module gets replaced by a client-reference stub on the server —
 * the object comes back `undefined` and every shot crashes on `shot.src`. Only
 * the motion wrapper it composes (`Reveal`) is client.
 */

import { Reveal } from "@/components/offer/motion/reveal";
import { cn } from "@/lib/utils";

interface ShotAsset {
  src: string;
  /** Intrinsic pixel size of the asset (2× the CSS stage it was captured at). */
  width: number;
  height: number;
}

export interface ShotSpec extends ShotAsset {
  /** Describes the product state shown — this is real UI, so be specific. */
  alt: string;
  /**
   * A separately-captured phone-width version. This is ART DIRECTION, not a
   * resize: the desktop shot squeezed into a ~350px column renders app UI at
   * ~7px, so the "real product pixels" argument evaporates on the traffic this
   * page is built for. Captured at 390px, it displays near 1:1.
   */
  mobile: ShotAsset;
}

/** The captured surfaces. Keep in sync with `shot-stages.tsx`. */
export const SHOTS = {
  paste: {
    src: "/images/offer/step-paste.webp",
    width: 1520,
    height: 434,
    alt: "The Maven composer with a TikTok link pasted in and the Test action selected",
    mobile: { src: "/images/offer/step-paste-sm.webp", width: 780, height: 402 },
  },
  react: {
    src: "/images/offer/step-react.webp",
    width: 1240,
    height: 1450,
    alt: "The simulated room: six named viewers who stopped, with what each one thought, and four who scrolled past",
    mobile: { src: "/images/offer/step-react-sm.webp", width: 780, height: 1242 },
  },
  verdict: {
    src: "/images/offer/step-verdict.webp",
    width: 1520,
    height: 926,
    alt: "A Maven verdict: craft score 77, hook 87, credibility 80, clarity 72, substance 70, and the video's frames with a flagged 0:06 drop",
    mobile: { src: "/images/offer/step-verdict-sm.webp", width: 780, height: 946 },
  },
  fixes: {
    src: "/images/offer/verdict-fixes.webp",
    width: 1240,
    height: 1552,
    alt: "The director's fixes: recut the open, with the frame it refers to, why it works, and a proven corpus example that did 14.2× its usual views",
    mobile: { src: "/images/offer/verdict-fixes-sm.webp", width: 780, height: 1122 },
  },
} satisfies Record<string, ShotSpec>;

/** The breakpoint the mobile captures are art-directed for (Tailwind `md`). */
const MOBILE_MEDIA = "(max-width: 767px)";

interface ProductShotProps {
  shot: ShotSpec;
  /** Tells the browser the rendered width so it never over-downloads. */
  sizes: string;
  /** Browser chrome above the image — for shots that are the whole app surface. */
  chrome?: boolean;
  /** Soften a deliberate crop so it reads as continuation, not truncation. */
  edge?: "none" | "fade";
  /** Prioritise the first below-hero shot; leave lazy for the rest. */
  priority?: boolean;
  className?: string;
  /** Cap the visible height and crop from the top (tall shots in short slots). */
  maxHeight?: number;
}

export function ProductShot({
  shot,
  sizes,
  chrome = false,
  edge = "none",
  priority = false,
  className,
  maxHeight,
}: ProductShotProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-surface-sunken",
        "shadow-[0_28px_70px_-30px_rgba(0,0,0,0.75)]",
        className,
      )}
    >
      {chrome && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-[11px] text-foreground-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            maven.numenmachines.com
          </span>
        </div>
      )}

      <div
        className="relative overflow-hidden"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {/* <picture> rather than next/image: the two variants are different CROPS,
            not two sizes of one image, and next/image has no art-direction API.
            The assets are already optimised WebP, so the loss is only the
            optimiser — and the browser downloads exactly one of them. */}
        <picture>
          <source media={MOBILE_MEDIA} srcSet={shot.mobile.src} width={shot.mobile.width} height={shot.mobile.height} />
          <img
            src={shot.src}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            sizes={sizes}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="block h-auto w-full"
          />
        </picture>
        {edge === "fade" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-sunken via-surface-sunken/70 to-transparent"
          />
        )}
      </div>
    </div>
  );
}

/**
 * ShotFigure — a shot with its caption, revealed as one unit. The caption states
 * what the visitor is looking at; on a page whose whole bet is "this is the real
 * product", an unlabeled screenshot wastes the claim.
 */
export function ShotFigure({
  shot,
  sizes,
  caption,
  chrome,
  edge,
  priority,
  maxHeight,
  className,
  delay = 0,
}: ProductShotProps & { caption?: React.ReactNode; delay?: number }) {
  return (
    <Reveal gesture="wipe" delay={delay} className={className}>
      <figure className="flex flex-col gap-3">
        <ProductShot
          shot={shot}
          sizes={sizes}
          chrome={chrome}
          edge={edge}
          priority={priority}
          maxHeight={maxHeight}
        />
        {caption && (
          <figcaption className="text-[12.5px] leading-relaxed text-foreground-muted">
            {caption}
          </figcaption>
        )}
      </figure>
    </Reveal>
  );
}
