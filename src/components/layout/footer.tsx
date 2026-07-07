import Link from "next/link";

import { cn, FOCUS_RING } from "@/lib/utils";
import { MavenLogo } from "@/components/brand/maven-logo";
import { NAV_LINKS } from "@/lib/nav";

interface FooterProps {
  className?: string;
}

/**
 * Legal placeholders (NAV-02) — labelled, swappable stub links the human
 * fills later. `href="#"` until real routes exist.
 */
const LEGAL_LINKS = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
] as const;

/**
 * Social placeholders (NAV-02) — labelled, swappable stub links. When real
 * external targets replace these, add rel="noopener noreferrer" on any
 * target blank (T-01-05); not applicable while they are in-page `#` stubs.
 */
const SOCIAL_LINKS = [
  { label: "X", href: "#" },
  { label: "TikTok", href: "#" },
] as const;

/**
 * Footer — flat-warm compact marketing chrome (NAV-02 · CONTEXT D-22 ·
 * UI-SPEC Component Inventory item 3).
 *
 * A STATIC server component (no interactivity — static chrome only). Flat-warm:
 * a tone-step surface with a hairline TOP border, no glass, no gradient, no
 * shine. Three compact columns:
 *  1. Brand — the MavenLogo gull (cream via currentColor) + a one-line tagline.
 *  2. Product — in-page anchor links mirroring the header nav set.
 *  3. Legal/social — Privacy · Terms and X · TikTok placeholder stub links.
 *
 * Rebuilt from scratch — every trace of the old plagiarized footer is gone
 * (no booking CTA, no email, no external brand links, no phosphor SSR icons).
 */
export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className={cn(
        // Flat tone-step surface + hairline TOP border (flat-matte, no glass/gradient).
        "border-t border-border bg-background-elevated",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1204px] px-4 py-16 md:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3">
          {/* 1 — Brand + tagline */}
          <div className="flex flex-col gap-3">
            <span className="flex items-center text-foreground">
              <MavenLogo size={24} />
            </span>
            <p className="max-w-[22ch] text-sm text-foreground-secondary">
              Know if it&apos;ll pop before you post.
            </p>
          </div>

          {/* 2 — Product anchors (mirror the header nav) */}
          <nav aria-label="Footer product links" className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "text-sm text-foreground-secondary transition-colors hover:text-foreground",
                      FOCUS_RING,
                      "focus-visible:ring-offset-background-elevated"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* 3 — Legal + social placeholders */}
          <div className="flex flex-col gap-6">
            <nav aria-label="Footer legal links" className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">Legal</h3>
              <ul className="flex flex-col gap-2">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={cn(
                      "text-sm text-foreground-secondary transition-colors hover:text-foreground",
                      FOCUS_RING,
                      "focus-visible:ring-offset-background-elevated"
                    )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Footer social links" className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">Social</h3>
              <ul className="flex flex-col gap-2">
                {SOCIAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={cn(
                      "text-sm text-foreground-secondary transition-colors hover:text-foreground",
                      FOCUS_RING,
                      "focus-visible:ring-offset-background-elevated"
                    )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Fine print — cream-muted, non-essential (≥ muted-contrast guidance). */}
        <p className="mt-12 border-t border-border pt-6 text-sm text-foreground-muted">
          &copy; {currentYear} Numen Machines
        </p>
      </div>
    </footer>
  );
}
