import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * CTA_VARIANT — the single dosage switch for the /go offer page's primary CTAs.
 *
 * "cream" is the shipped, dosage-compliant default: coral (`--color-accent`)
 * stays precious to the hero liveness + the one lit Pro destination, and every
 * primary CTA is cream (`--color-action`). Flip this ONE constant to "coral" to
 * run the conversion A/B — every primary CTA on the page follows in a single
 * edit, with no per-call-site changes and no accent literals scattered around.
 *
 * Keep it a plain module const (no client boundary) so `PrimaryCta` is safe to
 * render from server AND client sections alike.
 */
export const CTA_VARIANT: "cream" | "coral" = "cream";

const VARIANT_CLASS: Record<"cream" | "coral", string> = {
  cream: "bg-action text-action-foreground",
  coral: "bg-accent text-accent-foreground",
};

const SIZE_CLASS = {
  md: "h-11 px-5 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
} as const;

interface PrimaryCtaProps {
  href: string;
  children: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** Stretch to the container width (mobile bars, card footers). */
  full?: boolean;
  className?: string;
}

/**
 * PrimaryCta — the one styled primary action for the offer page. Reads
 * CTA_VARIANT so the whole page's CTA color is a single source of truth. In-page
 * hash targets render a plain `<a>` (native smooth-scroll to the anchor);
 * everything else routes through `next/link`.
 */
export function PrimaryCta({ href, children, size = "lg", full, className }: PrimaryCtaProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold",
    "transition-transform hover:scale-[1.02] active:scale-[0.99]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    VARIANT_CLASS[CTA_VARIANT],
    SIZE_CLASS[size],
    full && "w-full",
    className,
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
