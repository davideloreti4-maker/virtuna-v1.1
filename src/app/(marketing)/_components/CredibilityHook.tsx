/**
 * CredibilityHook (HERO-10) — above-fold credibility bar.
 * Server component — zero client JS.
 *
 * Renders INSIDE HeroBookend after the CTA pair (DOM order: HERO-11).
 *
 * Threat mitigations:
 * - T-03-01: rel="noopener noreferrer" on external link (prevents tab-napping)
 */

import type { JSX } from "react";

export function CredibilityHook(): JSX.Element {
  return (
    <div role="group" aria-label="Backed by" className="w-full">
      {/* 1px separator — Raycast 6% border token */}
      <div className="w-full h-px mb-4 bg-white/[0.06]" aria-hidden="true" />

      {/* Unified centered row — flex-wrap handles mobile reflow */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">

        {/* Numen Machines chip — coral left-border marks creator studio */}
        <a
          href="https://numenmachines.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Numen Machines — product studio behind Virtuna"
          className="flex items-center justify-center h-9 rounded-[8px] px-3 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:rounded-[8px]"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderLeftColor: "rgba(255,127,80,0.4)",
            borderLeftWidth: "2px",
            outlineColor: "rgba(255,127,80,0.6)",
          }}
        >
          <span className="text-sm font-medium text-foreground" style={{ letterSpacing: "0.2px" }}>
            Numen Machines
          </span>
        </a>

        <span className="hidden sm:inline text-foreground-muted text-xs select-none" aria-hidden="true">·</span>

        <span className="text-xs text-foreground-muted" style={{ letterSpacing: "0.2px" }}>
          Backed by behavioral research
        </span>
      </div>
    </div>
  );
}
