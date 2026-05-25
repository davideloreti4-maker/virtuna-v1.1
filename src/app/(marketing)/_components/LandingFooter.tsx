import Link from "next/link";
import { Twitter, Linkedin, Instagram } from "lucide-react";
import type { JSX } from "react";

/**
 * LandingFooter (CTA-03..06, D-13..16) — server-rendered 4-column footer.
 *
 * - 4 columns: Product / Company / Legal / Social (D-13)
 * - Stub routes: /privacy, /terms are real (D-14); About/Careers/Blog are aria-disabled stubs
 * - Sign-in link at bottom of Product column (CTA-06)
 * - Full-width "A Numen Machines product" strip + copyright below grid (CTA-04, D-16)
 * - Social: X / LinkedIn / TikTok / Instagram via lucide-react (D-15)
 * - WCAG AA verified (all text ≥ 4.5:1 contrast — UI-SPEC § Footer Contract WCAG table)
 *
 * Server component — no client JS (CTA-03).
 */
export function LandingFooter(): JSX.Element {
  const columnHeaderClass =
    "text-sm font-normal text-foreground-muted uppercase mb-4";
  const columnHeaderStyle = { letterSpacing: "0.08em" };

  const activeLinkClass =
    "text-sm text-foreground-secondary hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const activeLinkStyle = {
    lineHeight: 1.75,
    outlineColor: "#FF7F50",
  };

  return (
    <footer
      role="contentinfo"
      className="bg-background border-t"
      style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}
    >
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        {/* 4-column grid */}
        <nav aria-label="Footer navigation">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-8 md:grid-cols-4 md:gap-16">
            {/* Column 1: Product */}
            <div>
              <p className={columnHeaderClass} style={columnHeaderStyle}>
                Product
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="#demo"
                  className={activeLinkClass}
                  style={activeLinkStyle}
                >
                  Demo
                </Link>
                <Link
                  href="#how-it-works"
                  className={activeLinkClass}
                  style={activeLinkStyle}
                >
                  How it works
                </Link>
                <Link
                  href="#pricing"
                  className={activeLinkClass}
                  style={activeLinkStyle}
                >
                  Pricing
                </Link>
                <Link
                  href="#surfaces"
                  className={activeLinkClass}
                  style={activeLinkStyle}
                >
                  Three Surfaces
                </Link>
              </div>
              {/* Sign-in link — CTA-06 */}
              <div
                className="mt-4 pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <Link
                  href="/login"
                  className="text-sm text-foreground-muted hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Column 2: Company (all disabled per D-14) */}
            <div>
              <p className={columnHeaderClass} style={columnHeaderStyle}>
                Company
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="#"
                  aria-disabled="true"
                  tabIndex={-1}
                  className="text-sm text-foreground-secondary"
                  style={{
                    opacity: 0.35,
                    cursor: "default",
                    pointerEvents: "none",
                    lineHeight: 1.75,
                  }}
                >
                  About
                </a>
                <a
                  href="#"
                  aria-disabled="true"
                  tabIndex={-1}
                  className="text-sm text-foreground-secondary"
                  style={{
                    opacity: 0.35,
                    cursor: "default",
                    pointerEvents: "none",
                    lineHeight: 1.75,
                  }}
                >
                  Careers
                </a>
                <a
                  href="#"
                  aria-disabled="true"
                  tabIndex={-1}
                  className="text-sm text-foreground-secondary"
                  style={{
                    opacity: 0.35,
                    cursor: "default",
                    pointerEvents: "none",
                    lineHeight: 1.75,
                  }}
                >
                  Blog
                </a>
              </div>
            </div>

            {/* Column 3: Legal (real stub routes per D-14) */}
            <div>
              <p className={columnHeaderClass} style={columnHeaderStyle}>
                Legal
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/privacy"
                  className={activeLinkClass}
                  style={activeLinkStyle}
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className={activeLinkClass}
                  style={activeLinkStyle}
                >
                  Terms of Service
                </Link>
              </div>
            </div>

            {/* Column 4: Social (D-15) */}
            <div>
              <p className={columnHeaderClass} style={columnHeaderStyle}>
                Social
              </p>
              <div className="flex gap-2">
                <a
                  href="https://x.com/virtuna"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Virtuna on X"
                  className="flex h-11 w-11 items-center justify-center text-foreground-muted hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ outlineColor: "#FF7F50" }}
                >
                  <Twitter className="w-[18px] h-[18px]" aria-hidden="true" />
                </a>
                <a
                  href="https://linkedin.com/company/virtuna"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Virtuna on LinkedIn"
                  className="flex h-11 w-11 items-center justify-center text-foreground-muted hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ outlineColor: "#FF7F50" }}
                >
                  <Linkedin className="w-[18px] h-[18px]" aria-hidden="true" />
                </a>
                <a
                  href="https://www.tiktok.com/@virtuna"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Virtuna on TikTok"
                  className="flex h-11 w-11 items-center justify-center text-foreground-muted hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ outlineColor: "#FF7F50" }}
                >
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor" aria-hidden="true">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.19a8.16 8.16 0 004.77 1.52V7.27a4.85 4.85 0 01-1-.58z"/>
                  </svg>
                </a>
                <a
                  href="https://instagram.com/virtuna"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow Virtuna on Instagram"
                  className="flex h-11 w-11 items-center justify-center text-foreground-muted hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ outlineColor: "#FF7F50" }}
                >
                  <Instagram
                    className="w-[18px] h-[18px]"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* Numen Machines strip (CTA-04, D-16) */}
        <div
          className="mt-12 pt-6 flex flex-col items-center gap-2"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}
        >
          <a
            href="https://numenmachines.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            A Numen Machines product
          </a>
          <p className="text-sm text-foreground-muted" style={{ opacity: 0.6 }}>
            &copy; 2026 Numen Machines. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
