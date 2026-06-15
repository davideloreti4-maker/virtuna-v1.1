import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Image, Video, UserRound, Building2, Play } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Placeholder slot variant styles (class-variance-authority).
 *
 * Flat-warm, flat-matte stand-in surface (CONTEXT D-12/D-13/D-14, UI-SPEC
 * §Component Inventory item 1):
 *  - charcoal chip surface (`--color-surface-elevated` #2f2e2b)
 *  - hairline 6% border (`--color-border`), 12px radius (`--radius-lg`)
 *  - flat-matte only: no glass surface, no inset shine, no glow/halo, no dashed wireframe
 *
 * `variant` is the only CVA key. The aspect-ratio lock is applied via an inline
 * `style` (free CSS aspect-ratio string), NOT a CVA variant, so any ratio works.
 */
const placeholderVariants = cva(
  [
    // flat-matte chip surface + hairline border (no glass/shine/glow)
    "relative flex flex-col items-center justify-center overflow-hidden",
    "gap-2 bg-surface-elevated border border-[--color-border]",
    "text-foreground-muted",
  ],
  {
    variants: {
      variant: {
        image: "rounded-[--radius-lg]",
        video: "rounded-[--radius-lg]",
        avatar: "rounded-full",
        logo: "rounded-[--radius-lg]",
      },
    },
    defaultVariants: {
      variant: "image",
    },
  }
);

/** Lucide media-type glyph per variant (UI-SPEC item 1). */
const VARIANT_ICON = {
  image: Image,
  video: Video,
  avatar: UserRound,
  logo: Building2,
} as const;

type PlaceholderVariant = NonNullable<
  VariantProps<typeof placeholderVariants>["variant"]
>;

/** Default reserved aspect ratio per variant (no layout shift, D-14). */
const DEFAULT_ASPECT: Record<PlaceholderVariant, string> = {
  image: "16/9",
  video: "16/9",
  avatar: "1/1",
  logo: "3/1",
};

export interface PlaceholderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof placeholderVariants> {
  /**
   * Free CSS `aspect-ratio` string (e.g. `"16/9"`, `"4/5"`). Locks the reserved
   * box before any asset loads so the page never shifts. Falls back to the
   * per-variant default (`avatar` → `1/1`).
   */
  aspect?: string;
  /** Cream-muted caption shown beneath the media-type icon in the stand-in. */
  label?: string;
  /**
   * The one-prop swap. When present the real media renders (`<img>` for
   * image/avatar/logo, `<video>` for video); when absent the labelled stand-in
   * renders. `src` is a build-time developer path, never end-user input.
   */
  src?: string;
  /**
   * Opt in to a very-subtle reduced-motion-gated breathe on the stand-in icon.
   * Off by default. When on, applies `animate-skeleton-breathe` together with
   * `motion-reduce:animate-none` (mirrors `ui/skeleton.tsx`).
   */
  breathe?: boolean;
}

/**
 * Placeholder — the reusable, aspect-locked, flat-warm stand-in slot every
 * marketing section uses for product visuals until a real asset is swapped in
 * via the single `src` prop (FOUND-03).
 *
 * @example
 * ```tsx
 * // Labelled stand-in (no asset yet) — reserves a 16/9 box
 * <Placeholder variant="image" aspect="16/9" label="Hero demo" />
 *
 * // One-prop swap to the real screenshot — same reserved box, no shift
 * <Placeholder variant="image" aspect="16/9" label="Hero demo" src="/hero.png" />
 *
 * // Circular avatar stand-in
 * <Placeholder variant="avatar" label="Creator" />
 * ```
 */
const Placeholder = React.forwardRef<HTMLDivElement, PlaceholderProps>(
  (
    { className, variant = "image", aspect, label, src, breathe = false, style, ...props },
    ref
  ) => {
    // IN-04 NOT applied: CVA's VariantProps types `variant` as `... | null`, so
    // the `= "image"` destructure default (which only covers `undefined`) is not
    // enough — keep the `?? "image"` fallback to also coerce an explicit null.
    const resolvedVariant: PlaceholderVariant = variant ?? "image";
    const resolvedAspect = aspect ?? DEFAULT_ASPECT[resolvedVariant];
    const Icon = VARIANT_ICON[resolvedVariant];

    // The inline aspect-ratio reserves the box before any asset loads (D-14).
    const rootStyle: React.CSSProperties = { aspectRatio: resolvedAspect, ...style };

    return (
      <div
        ref={ref}
        data-variant={resolvedVariant}
        className={cn(placeholderVariants({ variant: resolvedVariant }), className)}
        style={rootStyle}
        {...props}
      >
        {src ? (
          // The one-prop swap → real media fills the reserved box.
          resolvedVariant === "video" ? (
            <video
              src={src}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              // FOUND-06 — heavy media must not block first paint: defer the
              // download until the element scrolls near the viewport.
              preload="none"
              aria-label={label}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- developer-supplied static stand-in asset
            <img
              src={src}
              alt={label ?? ""}
              className="h-full w-full object-cover"
              // FOUND-06 — lazy-load + async-decode so off-screen stand-ins
              // never block first paint (the box is already aspect-reserved).
              loading="lazy"
              decoding="async"
            />
          )
        ) : (
          // Labelled flat-warm stand-in (no asset yet).
          <>
            <span
              className={cn(
                "relative flex items-center justify-center",
                breathe && "animate-skeleton-breathe motion-reduce:animate-none"
              )}
            >
              <Icon
                className="h-8 w-8 opacity-30"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {resolvedVariant === "video" && (
                <Play
                  className="absolute h-4 w-4 fill-current opacity-40"
                  aria-hidden="true"
                />
              )}
            </span>
            {label && resolvedVariant !== "logo" && (
              <span className="text-sm text-foreground-muted">{label}</span>
            )}
          </>
        )}
      </div>
    );
  }
);
Placeholder.displayName = "Placeholder";

export { Placeholder, placeholderVariants };
