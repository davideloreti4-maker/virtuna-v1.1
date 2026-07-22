import { Image as ImageIcon, Play, User } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * MediaSlot — the swap-ready media placeholder for the /go offer page.
 *
 * Every below-hero image, screenshot, product video, and testimonial avatar is
 * a MediaSlot: a matte, clearly-labeled aspect-ratio box that reads as
 * "intentional, to be filled" — NOT broken and NOT a shipped fake. When the
 * owner has the real asset, pass `src` (an image) or `videoSrc` (a poster +
 * play affordance) and it renders that instead of the placeholder — a one-line
 * swap, no layout shift.
 *
 * Matte only: no glow, no glass. Depth is a hairline + a faint sunken ground; a
 * very slow `mavenShimmer` sweep (motion-safe) signals "placeholder" without a
 * spinner. Dashed border = empty; solid = filled.
 */

type MediaKind = "screenshot" | "video" | "thumbnail" | "avatar";

const KIND_ICON: Record<MediaKind, typeof ImageIcon> = {
  screenshot: ImageIcon,
  video: Play,
  thumbnail: ImageIcon,
  avatar: User,
};

interface MediaSlotProps {
  kind: MediaKind;
  /** What goes here — shown on the empty placeholder so the owner knows the ask. */
  label: string;
  /** CSS aspect-ratio, e.g. "16 / 9", "9 / 16", "1 / 1". Default 16/9. */
  aspect?: string;
  /** Optional dimension/format hint under the label (e.g. "1080×1920 · .mp4"). */
  hint?: string;
  /** Swap in a real image — renders it, drops the placeholder chrome. */
  src?: string;
  /** Swap in a real video — renders <video> with this poster + a play badge. */
  videoSrc?: string;
  poster?: string;
  className?: string;
}

export function MediaSlot({
  kind,
  label,
  aspect = "16 / 9",
  hint,
  src,
  videoSrc,
  poster,
  className,
}: MediaSlotProps) {
  const Icon = KIND_ICON[kind];
  const filled = Boolean(src || videoSrc);
  const rounded = kind === "avatar" ? "rounded-full" : "rounded-xl";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        rounded,
        filled
          ? "border border-border-hover/40 bg-surface-sunken shadow-[0_10px_26px_-8px_rgba(0,0,0,0.5)]"
          // lighter than both bg + surface so an empty slot always reads as an
          // intentional panel, on any ground it sits on
          : "border border-dashed border-border-hover/60 bg-background-elevated",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      {/* Filled: the real asset. */}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {videoSrc && (
        <>
          <video
            className="absolute inset-0 h-full w-full object-cover"
            poster={poster}
            muted
            playsInline
            preload="none"
          >
            <source src={videoSrc} />
          </video>
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-background/70 text-foreground shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6)]">
              <Play size={22} weight="fill" aria-hidden />
            </span>
          </div>
        </>
      )}

      {/* Empty: the labeled placeholder. */}
      {!filled && (
        <>
          {/* faint sweep — reads "to be filled", not "loading" */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.6] motion-safe:animate-[mavenShimmer_6s_linear_infinite]"
            style={{
              backgroundImage:
                "linear-gradient(105deg,transparent 38%,rgba(236,231,222,0.05) 50%,transparent 62%)",
              backgroundSize: "200% 100%",
            }}
          />
          {/* faint dot-grid, so the box has texture even bare */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px,rgba(236,231,222,0.045) 1px,transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <span
              className={cn(
                "grid place-items-center rounded-lg border border-border text-foreground-muted",
                kind === "video" ? "h-11 w-11" : "h-9 w-9",
              )}
            >
              <Icon size={kind === "video" ? 22 : 18} aria-hidden />
            </span>
            <span className="text-[12.5px] font-medium leading-tight text-foreground-secondary">
              {label}
            </span>
            {hint && (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-foreground-muted/80">
                {hint}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
