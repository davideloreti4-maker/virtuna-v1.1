import { cn } from "@/lib/utils";

/**
 * Slot — the placeholder primitive for every image, video, portrait and product
 * shot on the trial page.
 *
 * WHY IT IS NOT A DASHED BOX. The usual placeholder is a dashed outline around
 * nothing, which turns a design review into a wireframe review: dashed rectangles
 * read as "unfinished", carry no visual mass, and make it impossible to judge the
 * composition they sit in. A slot here is a REAL surface — the same card tone the
 * finished asset will sit on, a hairline border, a faint dot grid — so the page
 * has its true weight and rhythm with the assets still missing. What marks it as
 * pending is the mono caption naming exactly what belongs there and at what
 * aspect, not a border style.
 *
 * Every slot is `aria-hidden` and carries no alt text: it is scaffolding, and a
 * screen reader announcing "product window 16:10" would be describing the
 * scaffolding rather than the page.
 */

type SlotVariant = "window" | "image" | "video" | "portrait" | "avatar" | "logo";

interface SlotProps {
  variant?: SlotVariant;
  /** What belongs here, in the author's words. Shown in mono, uppercased. */
  label?: string;
  /** CSS aspect-ratio, e.g. "16 / 10". Defaults per variant. */
  ratio?: string;
  className?: string;
  /**
   * Marks the slot as MOTION pending — a demo video or product animation.
   * Renders a centred play button over the content. "lg" for hero-scale
   * frames, "sm" for cards. Purely visual: the placeholder is not clickable.
   */
  play?: "sm" | "lg";
  /** Runtime chip appended to the caption, e.g. "0:45". */
  duration?: string;
  /**
   * A sketch (see sketch.tsx) drawn inside the frame. With children, the slot
   * stops being a void: the sketch fills it and the caption shrinks to a
   * corner chip. Without, the centred glyph + caption stack renders as before.
   */
  children?: React.ReactNode;
}

const DEFAULT_RATIO: Record<SlotVariant, string> = {
  window: "16 / 10",
  image: "4 / 3",
  video: "16 / 9",
  portrait: "4 / 5",
  avatar: "1 / 1",
  logo: "5 / 2",
};

const RADIUS: Record<SlotVariant, string> = {
  window: "rounded-2xl",
  image: "rounded-xl",
  video: "rounded-xl",
  portrait: "rounded-xl",
  avatar: "rounded-full",
  logo: "rounded-md",
};

/** Variants too small to caption legibly — surface and glyph only. */
const MUTE_CAPTION: ReadonlySet<SlotVariant> = new Set(["avatar", "logo"]);

/** 16px dot grid. Same texture across every slot so they read as one system. */
const DOT_GRID = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(236,231,222,0.05) 1px, transparent 0)",
  backgroundSize: "16px 16px",
} as const;

/** The "motion pending" affordance — a solid matte disc, hairline ring, cream
 *  triangle. No glow, no glass blur: matte is the system. */
function PlayButton({ size }: { size: "sm" | "lg" }) {
  const px = size === "lg" ? 64 : 44;
  return (
    <span
      className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)]"
      style={{ width: px, height: px, background: "rgba(26,26,25,0.92)" }}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: px * 0.34, height: px * 0.34, marginLeft: px * 0.04 }}
        fill="#ece7de"
      >
        <path d="M7.5 5.2 19 12 7.5 18.8z" />
      </svg>
    </span>
  );
}

function Glyph({ variant }: { variant: SlotVariant }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (variant) {
    case "video":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10.2 8.8 15.4 12l-5.2 3.2z" />
        </svg>
      );
    case "portrait":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" {...common}>
          <circle cx="12" cy="9" r="3.4" />
          <path d="M5.6 19.4a6.8 6.8 0 0 1 12.8 0" />
        </svg>
      );
    case "avatar":
      return (
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" {...common}>
          <circle cx="12" cy="9.5" r="3.2" />
          <path d="M5.8 19.2a6.6 6.6 0 0 1 12.4 0" />
        </svg>
      );
    case "logo":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" {...common}>
          <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" />
          <path d="M9 14.5 12 9l3 5.5z" />
        </svg>
      );
    case "window":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 9h18" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="m6.5 16.5 4-4.6 3.2 3.4 2.4-2.2 3.4 3.4" />
          <circle cx="9.4" cy="9.2" r="1.2" />
        </svg>
      );
  }
}

export function Slot({
  variant = "image",
  label,
  ratio,
  className,
  play,
  duration,
  children,
}: SlotProps) {
  const captioned = !MUTE_CAPTION.has(variant) && Boolean(label);
  const shownRatio = ratio ?? DEFAULT_RATIO[variant];
  const sketched = Boolean(children);
  const caption = duration ? `${label} · ${duration}` : label;

  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden",
        !sketched && "flex items-center justify-center",
        "border border-[color:var(--lp-line-strong)] bg-[color:var(--lp-card)]",
        RADIUS[variant],
        className,
      )}
      style={{ aspectRatio: shownRatio, ...(sketched ? {} : DOT_GRID) }}
    >
      {/* The window variant gets a chrome rail so it carries the mass of a real
          app screenshot in the composition. No traffic-light dots — that cliché
          dates a page instantly, and the product's own chrome has none. */}
      {variant === "window" && !sketched && (
        <div className="absolute inset-x-0 top-0 h-9 border-b border-[color:var(--lp-line)] bg-[color:var(--lp-bg-alt)]" />
      )}

      {play && <PlayButton size={play} />}

      {sketched ? (
        <>
          {children}
          {captioned && (
            <span className="absolute bottom-3 left-3 rounded-md border border-[color:var(--lp-line)] bg-[color:var(--lp-bg-alt)] px-2 py-1">
              <span className="lp-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--lp-fg-3)]">
                {caption}
              </span>
            </span>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2.5 px-4 text-center text-[color:var(--lp-fg-3)]">
          {!play && <Glyph variant={variant} />}
          {captioned && (
            <div className={cn("flex flex-col items-center gap-1", play && "translate-y-10")}>
              <span className="lp-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--lp-fg-3)]">
                {caption}
              </span>
              <span className="lp-mono text-[10px] tracking-[0.08em] text-[color:var(--lp-fg-3)]/60">
                {shownRatio.replace(/\s/g, "")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
