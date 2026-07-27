import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * CTA_VARIANT — the single dosage switch for the /go offer page's primary CTAs.
 *
 * "coral" is live — owner call 2026-07-26 ("we want a high conversion rate").
 * It spends the accent (`--color-accent`) on every primary CTA; "cream"
 * (`--color-action`) is the dosage-compliant fallback if the accent starts
 * competing with the hero liveness. One constant — every primary CTA on the
 * page follows in a single edit, with no per-call-site changes and no accent
 * literals scattered around.
 *
 * Keep it a plain module const (no client boundary) so `PrimaryCta` is safe to
 * render from server AND client sections alike.
 */
export const CTA_VARIANT: "cream" | "coral" = "coral";

/**
 * FREE_ENTRY — the one entry ask of the page (reconciled 2026-07-27, retargeted 2026-07-27).
 *
 * The page gives a free, no-account Test; every below-fold momentum CTA used
 * to sell "$1" against it and route to /signup — the bare email round-trip the
 * funnel replaced. All entry CTAs share this SSOT and sell what the click
 * actually gives: a free read. The $1 stays where money is decided — the
 * pricing section's trial mechanics and the wall inside the product.
 *
 * `href` USED to be `#test`, the id on the hero composer. The composer left the
 * fold (owner call: the demo below is a non-interactive probe and the entry is
 * a button), so the target is now the thread itself. It is NOT navigable as a
 * plain link — `/home` redirects an unauthenticated visitor to `/login` — so
 * every entry CTA goes through `FreeEntryCta`, which mints the anonymous
 * session first. This constant stays the SSOT for the label, the microcopy and
 * the destination; `href` is the post-session push target and the honest `<a>`
 * fallback for crawlers and no-JS.
 */
export const FREE_ENTRY = {
  href: "/home?v=Test",
  label: "Test a video free",
  microcopy: "No account needed — the full verdict unlocks for $1 after",
} as const;

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
 * The primary CTA's class string, shared by `PrimaryCta` and the client-side
 * `FreeEntryCta` so the page's one action looks identical whether it navigates
 * or has to mint a session first. Plain function, no client boundary.
 */
export function primaryCtaClass({
  size = "lg",
  full,
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  full?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold",
    "transition-transform hover:scale-[1.02] active:scale-[0.99]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-70",
    VARIANT_CLASS[CTA_VARIANT],
    SIZE_CLASS[size],
    full && "w-full",
    className,
  );
}

/**
 * PrimaryCta — the one styled primary action for the offer page. Reads
 * CTA_VARIANT so the whole page's CTA color is a single source of truth. In-page
 * hash targets render a plain `<a>` (native smooth-scroll to the anchor);
 * everything else routes through `next/link`.
 */
export function PrimaryCta({ href, children, size = "lg", full, className }: PrimaryCtaProps) {
  const cls = primaryCtaClass({ size, full, className });

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
