import { cn } from "@/lib/utils";

/**
 * The mark. A rounded aperture with a falling line inside it — the retention
 * curve, which is the page's signature and the product's actual instrument.
 * Tying the mark to the signature means the logo, the hero and the receipts all
 * say the same thing in three sizes.
 *
 * Cream, not accent. The app's dosage rule does sanction the brand mark as an
 * accent use, but spending it here would put coral in the fixed nav on every
 * scroll position of the page, permanently competing with the CTA beside it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn("h-[22px] w-[22px]", className)}
      fill="none"
    >
      <rect
        x="1.75"
        y="1.75"
        width="20.5"
        height="20.5"
        rx="6.5"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.25"
      />
      <path
        d="M5.75 8.25c2.4.35 3.75 1.2 4.85 3.1 1.1 1.9 3.1 3.6 7.65 4.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("flex items-center gap-2.5 text-[color:var(--lp-fg)]", className)}
    >
      <BrandMark />
      <span
        className="text-[17px] font-semibold tracking-[-0.02em]"
        style={{ fontFamily: "var(--lp-font-display)" }}
      >
        Maven
      </span>
    </span>
  );
}
