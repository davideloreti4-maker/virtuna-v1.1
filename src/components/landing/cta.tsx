import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The page's two asks, and the single place their destinations are written.
 *
 * PRIMARY is the $1 trial and it is the only thing this page exists to sell.
 * `/api/whop/checkout` requires an authenticated user, so an anonymous visitor
 * cannot be sent straight to Whop — the path is signup first, carrying the plan
 * and the trial intent, then into the checkout embed. The querystring shape is
 * what /signup will need to read; wiring it is a follow-up, and until then the
 * link lands on signup, which is a working page rather than a 404.
 *
 * SECONDARY is the skeptic's door. It points at the existing free-test funnel,
 * which already mints the anonymous session that a no-account test requires.
 * ⚠️ If this page ever REPLACES /go, this href stops working and the secondary
 * needs its own session mint — that is the one piece of real wiring this page
 * does not carry.
 */
export const PRIMARY_CTA = {
  href: "/signup?plan=pro&trial=1&next=checkout",
  label: "Start for $1",
} as const;

export const SECONDARY_CTA = {
  href: "/go",
  label: "Try it on your video first",
} as const;

/**
 * The risk microcopy. It carries BOTH surprises a buyer could otherwise hit —
 * the trial pool is capped and it renews at the plan price — because burying
 * either one is how a $1 offer earns chargebacks. Mirrors `TRIAL.microcopy` in
 * lib/pricing.ts; if that changes, this changes.
 */
export const TRIAL_MICROCOPY = "$1 for 3 days · 50 credits · cancel anytime";

type Size = "md" | "lg";

const SIZE: Record<Size, string> = {
  md: "h-10 px-4 text-[13px] rounded-lg",
  lg: "h-12 px-6 text-[15px] rounded-[10px]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap " +
  "transition-[transform,background-color,border-color] duration-200 " +
  // Hover = a one-pixel rise; press = a settle. Matte physicality without a
  // single shadow or glow — the same grammar the interactive cards use.
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.985] focus-visible:outline-none";

interface CtaProps {
  href?: string;
  children?: React.ReactNode;
  size?: Size;
  full?: boolean;
  className?: string;
}

/** Solid accent. One of the three sanctioned accent jobs on this page. */
export function PrimaryCta({
  href = PRIMARY_CTA.href,
  children = PRIMARY_CTA.label,
  size = "lg",
  full,
  className,
}: CtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        BASE,
        SIZE[size],
        "bg-[color:var(--lp-accent)] text-[color:var(--lp-on-accent)]",
        "hover:bg-[#ff7676]",
        full && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Outlined cream. Carries no accent — the primary must never have competition. */
export function GhostCta({
  href = SECONDARY_CTA.href,
  children = SECONDARY_CTA.label,
  size = "lg",
  full,
  className,
}: CtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        BASE,
        SIZE[size],
        "border border-[color:var(--lp-line-strong)] text-[color:var(--lp-fg)]",
        "hover:border-[rgba(255,255,255,0.2)] hover:bg-[color:var(--lp-card)]",
        full && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Both asks, stacked on phones and inline from `sm` up. */
export function CtaPair({ className, size = "lg" }: { className?: string; size?: Size }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <PrimaryCta size={size} />
      <GhostCta size={size} />
    </div>
  );
}
