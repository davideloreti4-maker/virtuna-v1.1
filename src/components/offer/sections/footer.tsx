import Link from "next/link";

import { MavenMark } from "@/components/brand/maven-logo";
import { SIGNUP_URL } from "@/lib/routes";

/**
 * Offer footer — minimal + matte. The quiet Numen endorsement (house brand) and
 * a last low-key way in. No legal link columns: /terms, /privacy, /trial-policy
 * don't exist yet (flagged in the handoff — needed before real paid traffic), so
 * we don't ship dead links.
 */
export function OfferFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row">
        <span className="flex items-center gap-2.5 text-sm text-foreground-muted">
          <MavenMark size={16} />
          <span className="font-semibold text-foreground-secondary">Maven</span>
          <span className="text-foreground-muted/70">— a Numen Machines product</span>
        </span>

        <div className="flex items-center gap-5 text-sm">
          <Link
            href={SIGNUP_URL}
            className="text-foreground-secondary transition-colors hover:text-foreground"
          >
            Start for $1
          </Link>
          <span className="text-foreground-muted/70">© {year} Numen Machines</span>
        </div>
      </div>
    </footer>
  );
}
