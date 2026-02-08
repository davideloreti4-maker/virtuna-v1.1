import { cn } from "@/lib/utils";

const logos = [
  "TikTok",
  "YouTube",
  "Instagram",
  "X",
  "Reddit",
  "Spotify",
  "LinkedIn",
  "Twitch",
  "Pinterest",
  "Snapchat",
];

interface LogoCloudSectionProps {
  className?: string;
}

/**
 * Logo cloud with CSS-only marquee animation.
 * Server component — no JS required for the scroll effect.
 * Respects prefers-reduced-motion via CSS media query.
 */
export function LogoCloudSection({ className }: LogoCloudSectionProps) {
  return (
    <section className={cn("py-12 md:py-16", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-8 text-center text-sm uppercase tracking-wider text-foreground-muted">
          Tracking trends across platforms
        </p>
      </div>

      {/* Marquee container — full width with gradient masks */}
      <div className="relative overflow-hidden">
        {/* Left fade mask */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        {/* Right fade mask */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

        {/* Scrolling track — duplicated for seamless loop */}
        <div className="flex w-max animate-marquee items-center gap-8 hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:w-auto motion-reduce:mx-auto motion-reduce:max-w-6xl motion-reduce:px-6 motion-reduce:gap-4">
          {/* First set */}
          {logos.map((name) => (
            <div
              key={`a-${name}`}
              className="flex shrink-0 items-center rounded-md border border-white/[0.06] px-6 py-3"
            >
              <span className="text-sm font-medium text-foreground-muted/60">
                {name}
              </span>
            </div>
          ))}
          {/* Duplicate set for seamless loop */}
          {logos.map((name) => (
            <div
              key={`b-${name}`}
              aria-hidden="true"
              className="flex shrink-0 items-center rounded-md border border-white/[0.06] px-6 py-3"
            >
              <span className="text-sm font-medium text-foreground-muted/60">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
