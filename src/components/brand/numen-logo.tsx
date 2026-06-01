import { cn } from "@/lib/utils";

/**
 * NumenLogo — the Numen Machines brand mark.
 *
 * Primary mark "node": four nodes trace an implied "N" with a central hub
 * node at the diagonal's crossing — an intelligence/knowledge graph forming
 * the initial. Echoes the product's own node-cluster visuals. Monochrome,
 * driven by `currentColor` so it inherits the surrounding text color.
 *
 * "letter" is a fallback monoline letterform for ultra-small / dense uses.
 *
 * Usage:
 *   <NumenLogo />                          // node mark + NUMEN wordmark
 *   <NumenMark size={24} />                // bare node mark (sidebar / favicon)
 *   <NumenLogo wordmark="full" />          // NUMEN + MACHINES lockup
 *   <NumenMark variant="letter" />         // monoline N fallback
 */
type MarkVariant = "node" | "letter";

type NumenLogoProps = {
  /** Mark height in px. Default 22. */
  size?: number;
  /** Which wordmark to render alongside the mark. Default "numen". */
  wordmark?: "numen" | "full" | "none";
  /** Mark style. Default "node". */
  variant?: MarkVariant;
  /** Extra classes on the root element. */
  className?: string;
};

export function NumenMark({
  size = 22,
  variant = "node",
  className,
}: {
  size?: number;
  variant?: MarkVariant;
  className?: string;
}) {
  if (variant === "letter") {
    // Monoline N letterform, tight viewBox (taller than wide).
    const ratio = 54 / 64;
    return (
      <svg
        width={size * ratio}
        height={size}
        viewBox="0 0 54 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <path
          d="M7 58 V6 L47 58 V6"
          stroke="currentColor"
          strokeWidth={7}
          fill="none"
          strokeLinejoin="miter"
          strokeLinecap="square"
        />
      </svg>
    );
  }

  // Intelligence-node N: edges trace the N, small terminal nodes at the
  // vertices feed a larger hub at the diagonal's center — signal converging
  // to a core. Leaner stance + thinner, slightly recessed edges give the
  // node hierarchy room to read. Tight viewBox so it fills its box.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M28 78 V22 L72 78 V22"
        stroke="currentColor"
        strokeWidth={3.4}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
      <circle cx="28" cy="78" r="5" fill="currentColor" />
      <circle cx="28" cy="22" r="5" fill="currentColor" />
      <circle cx="72" cy="78" r="5" fill="currentColor" />
      <circle cx="72" cy="22" r="5" fill="currentColor" />
      <circle cx="50" cy="50" r="8.5" fill="currentColor" />
    </svg>
  );
}

export function NumenLogo({
  size = 22,
  wordmark = "numen",
  variant = "node",
  className,
}: NumenLogoProps) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <NumenMark size={size} variant={variant} className="shrink-0" />
      {wordmark !== "none" && (
        <span className="flex flex-col justify-center leading-none">
          {/* color is inherited from the parent so each placement controls it */}
          <span className="text-[15px] font-semibold uppercase tracking-[0.16em]">
            Numen
          </span>
          {wordmark === "full" && (
            <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.42em] opacity-60">
              Machines
            </span>
          )}
        </span>
      )}
    </span>
  );
}
