import { Check, X } from "lucide-react";

import { VerdictSwatch } from "@/components/numen/verdict-swatch";

/**
 * HonestyComparison — TRUST-01 / TRUST-02, the #honesty kero comparison move.
 *
 * A semantic `<table>` contrasting Numen's calibrated honest verdict (band +
 * one-line why) against an UNNAMED generic "Virality-score tools" tier (D-04 —
 * never a named rival). This is the ONE component on the page where the
 * sanctioned rival strings ("viral score", "95% accuracy", "guaranteed views")
 * appear (D-05) — used ONLY to label the rejected category, never as a Numen
 * claim. The page-wide voice gate (voice.test.tsx) bans these strings
 * everywhere else and positively scopes them to this file.
 *
 * Numen cells stay VOICE-clean: band + one-line why, never a number, no engine
 * jargon, no "%". The rival cells state the snake-oil pattern plainly and quietly
 * (text-text-muted) — tasteful contrast, NOT a teardown.
 *
 * Static RSC (no `"use client"`). Emits NO `<h1>`/`<h2>` of its own — the
 * `#honesty` h2 lives on the SectionShell slot in page.tsx (D-10 single-h1
 * invariant). Color by token NAME only — no hex in JSX (DS-01 / Phase-4 swap).
 */
export function HonestyComparison() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Antidote framing — no number as a Numen claim (D-11, VOICE Rule 2). */}
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-muted md:mt-8 md:text-lg">
        Other tools hand you a number and call it certainty. Numen tells you the
        truth about your video — and the one thing to fix.
      </p>

      <div className="mt-8 overflow-hidden rounded-[12px] border border-border bg-panel">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Numen compared to virality-score tools
          </caption>
          <thead>
            <tr className="border-b border-border">
              {/* Dimension corner — empty header, scoped for AT. */}
              <th
                scope="col"
                className="p-4 text-sm font-normal text-text-muted"
              >
                <span className="sr-only">Dimension</span>
              </th>
              <th
                scope="col"
                className="border-l border-border p-4 text-sm font-bold text-text"
              >
                Numen
              </th>
              <th
                scope="col"
                className="border-l border-border p-4 text-sm font-normal text-text-muted"
              >
                Virality-score tools
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Row 1 — What you get: the honest verdict band vs a viral score. */}
            <tr className="border-b border-border">
              <th
                scope="row"
                className="p-4 align-top text-sm font-bold text-text"
              >
                What you get
              </th>
              <td className="border-l border-border p-4 align-top">
                <div className="rounded-[12px] border border-border bg-panel p-4">
                  <span className="inline-flex items-center gap-2">
                    <VerdictSwatch verdict="good" size="md" />
                    <span className="text-sm font-bold text-text md:text-base">
                      An honest verdict you can act on.
                    </span>
                  </span>
                </div>
              </td>
              <td className="border-l border-border p-4 align-top">
                <span className="inline-flex items-start gap-2">
                  <X
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                  />
                  <span className="text-base leading-relaxed text-text-muted">
                    A viral score out of 100.
                  </span>
                </span>
              </td>
            </tr>

            {/* Row 2 — How it reads: sharpest-audience read vs a black box. */}
            <tr className="border-b border-border">
              <th
                scope="row"
                className="p-4 align-top text-sm font-bold text-text"
              >
                How it reads
              </th>
              <td className="border-l border-border p-4 align-top">
                <span className="inline-flex items-start gap-2">
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                  />
                  <span className="text-sm leading-relaxed text-text md:text-base">
                    Reads your video like your sharpest audience would.
                  </span>
                </span>
              </td>
              <td className="border-l border-border p-4 align-top">
                <span className="inline-flex items-start gap-2">
                  <X
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                  />
                  <span className="text-base leading-relaxed text-text-muted">
                    A black-box percentage.
                  </span>
                </span>
              </td>
            </tr>

            {/* Row 3 — What it promises: the one fix vs fake-precision hype. */}
            <tr>
              <th
                scope="row"
                className="p-4 align-top text-sm font-bold text-text"
              >
                What it promises
              </th>
              <td className="border-l border-border p-4 align-top">
                <span className="inline-flex items-start gap-2">
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                  />
                  <span className="text-sm leading-relaxed text-text md:text-base">
                    The one thing to fix — and when it&apos;ll land.
                  </span>
                </span>
              </td>
              <td className="border-l border-border p-4 align-top">
                <span className="inline-flex items-start gap-2">
                  <X
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                  />
                  <span className="text-base leading-relaxed text-text-muted">
                    95% accuracy. Guaranteed views.
                  </span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
