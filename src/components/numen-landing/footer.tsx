import Link from "next/link";

import { NumenLogo } from "@/components/brand/numen-logo";

/**
 * Footer — the minimal static Numen landing footer (D-07).
 *
 * Server component (no state). Brand + one-line positioning on the left;
 * anchor repeat, legal, social, and a CTA slot on the right. External social
 * links carry `rel="noopener noreferrer"` (reverse-tabnabbing mitigation,
 * T-01-03). Rebuilt clean from the stale societies footer — `.numen-surface`
 * tokens, focus rings, no Phosphor, no newsletter/sitemap sprawl.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const LINK = `rounded-md text-sm text-text-muted transition-colors hover:text-text ${FOCUS_RING}`;

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-bg border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-start md:justify-between md:px-6">
        {/* Left: brand + positioning */}
        <div className="flex max-w-sm flex-col gap-3">
          <span className="flex items-center text-text">
            <NumenLogo />
          </span>
          <p className="text-sm text-text-muted">
            The honest verdict on your content — before you post.
          </p>
        </div>

        {/* Right: link columns + CTA */}
        <div className="flex flex-col gap-8 md:items-end">
          {/* Anchor repeat (plain div — the single <nav> landmark is the top nav) */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 md:justify-end">
            <Link href="#how-it-works" className={LINK}>
              How it works
            </Link>
            <Link href="#honesty" className={LINK}>
              Honesty
            </Link>
            <Link href="#gallery" className={LINK}>
              Gallery
            </Link>
          </div>

          {/* Legal + social */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 md:justify-end">
            <Link href="#" className={LINK}>
              Privacy
            </Link>
            <Link href="#" className={LINK}>
              Terms
            </Link>
            <a
              href="https://x.com/numen"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
              aria-label="Numen on X"
            >
              X
            </a>
            <a
              href="https://www.linkedin.com/company/numen"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
              aria-label="Numen on LinkedIn"
            >
              LinkedIn
            </a>
          </div>

          {/* CTA slot */}
          <Link
            href="#cta"
            className={`inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90 ${FOCUS_RING}`}
          >
            Try Numen
          </Link>
        </div>
      </div>

      {/* Copyright */}
      <div className="mx-auto max-w-6xl px-4 pb-12 md:px-6">
        <p className="text-sm text-text-muted">© {currentYear} Numen</p>
      </div>
    </footer>
  );
}
