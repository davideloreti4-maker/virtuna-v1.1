/**
 * CredibilityHook (HERO-10) — above-fold credibility bar.
 * Server component — zero client JS.
 *
 * Renders INSIDE HeroBookend, replacing the hidden md:block min-h-[64px] placeholder div.
 * Desktop: 64px total height (1px separator + 16px mb + 40px logo row = 57px ~ rounds to 64px slot).
 * Mobile: max 48px.
 *
 * Reading order: appears AFTER CTA pair in DOM (HERO-11).
 *
 * Threat mitigations:
 * - T-03-01: rel="noopener noreferrer" on external link (prevents tab-napping)
 */

import type { JSX } from "react";

export function CredibilityHook(): JSX.Element {
  return (
    <section aria-label="Backed by" className="w-full">
      {/* 1px separator line — full width, 16px bottom margin */}
      <div
        className="w-full h-px mb-4"
        style={{ background: "rgba(255,255,255,0.06)" }}
        aria-hidden="true"
      />

      {/* Desktop row: [Numen slot] [4 placeholder slots] [microcopy] */}
      {/* hidden on mobile, replaced by mobile layout below */}
      <div className="hidden md:flex items-center justify-center gap-2 h-10">

        {/* Numen Machines slot — coral left-border accent, linked to numenmachines.com */}
        <a
          href="https://numenmachines.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Numen Machines — product studio behind Virtuna"
          className="flex items-center justify-center h-10 w-[120px] rounded-[8px] px-3 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:rounded-[8px]"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderLeftColor: "rgba(255,127,80,0.4)",
            borderLeftWidth: "2px",
            outlineColor: "rgba(255,127,80,0.6)",
          }}
        >
          <span
            className="text-sm font-medium text-foreground"
            style={{ letterSpacing: "0.2px" }}
          >
            Numen Machines
          </span>
        </a>

        {/* 4 placeholder partner slots */}
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="flex items-center justify-center h-10 min-w-[80px] max-w-[120px] rounded-[8px] px-3"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span
              className="text-xs text-foreground-muted"
              style={{ opacity: 0.5, letterSpacing: "0.2px" }}
            >
              Partner
            </span>
          </div>
        ))}

        {/* Microcopy */}
        <p
          className="ml-4 text-xs text-foreground-muted"
          style={{ letterSpacing: "0.2px" }}
        >
          Backed by behavioral research{" "}
          <span aria-hidden="true">·</span>{" "}
          <span className="font-medium">Numen Machines</span>
        </p>
      </div>

      {/* Mobile layout: microcopy above, 3 slots (Numen + 2 placeholders) below, centered */}
      {/* md:hidden — only renders on < 768px */}
      <div className="flex md:hidden flex-col items-center gap-2">
        <p
          className="text-xs text-center text-foreground-muted"
          style={{ letterSpacing: "0.2px" }}
        >
          Backed by behavioral research{" "}
          <span aria-hidden="true">·</span>{" "}
          <span className="font-medium">Numen Machines</span>
        </p>
        <div className="flex items-center gap-2">
          {/* Numen Machines slot */}
          <a
            href="https://numenmachines.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Numen Machines — product studio behind Virtuna"
            className="flex items-center justify-center h-9 w-[100px] rounded-[8px] px-2 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:rounded-[8px]"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderLeftColor: "rgba(255,127,80,0.4)",
              borderLeftWidth: "2px",
              outlineColor: "rgba(255,127,80,0.6)",
            }}
          >
            <span
              className="text-xs font-medium text-foreground"
              style={{ letterSpacing: "0.2px" }}
            >
              Numen Machines
            </span>
          </a>
          {/* 2 placeholder slots */}
          {[1, 2].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="flex items-center justify-center h-9 w-[72px] rounded-[8px] px-2"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span
                className="text-xs text-foreground-muted"
                style={{ opacity: 0.5, letterSpacing: "0.2px" }}
              >
                Partner
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
