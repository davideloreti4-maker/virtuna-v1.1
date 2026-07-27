/**
 * The metrics band — Attio/Cursor grammar (a row of large numbers under a rule).
 *
 * ⚠️ THESE ARE THE ONLY THREE NUMBERS THAT EXIST. 500 dissected videos, 10 named viewers,
 * ~90s to a verdict. They are the same three `ProofMechanism` carries, stated here in the
 * reference's grammar rather than in a card. There is no fourth metric to add: no user count,
 * no "videos tested", no average lift, no rating. If a number is not one of these three or the
 * cited 231 → 183,000 receipt, it does not exist and must not be invented to fill the row.
 *
 * Every claim on this page is stated exactly ONCE — that rule is why the hero's subhead does
 * not repeat "500" and why `PlatformBar` carries no viewer count.
 *
 * Motion: each underline re-draws on an 11.31s cycle, staggered per column, so the band never
 * fully settles. Nothing else in this section moves — three big numbers is already the loudest
 * thing on the page and a pulsing one would be noise.
 */

import { MarketingSection } from "../marketing-shell";
import { ambientLoop } from "../ambient";

interface Metric {
  value: string;
  label: string;
}

const METRICS: readonly Metric[] = [
  { value: "500", label: "viral videos dissected into the corpus" },
  { value: "10", label: "named viewers react, with their words" },
  { value: "~90s", label: "from input to a full verdict" },
];

export function MetricsBand() {
  return (
    <MarketingSection tone="sunken" seam seamIndex={5} compact>
      <div className="grid gap-10 md:grid-cols-3 md:gap-8">
        {METRICS.map((m, i) => (
          <div key={m.label} className="text-center md:text-left">
            <span
              className="block text-[clamp(2.6rem,5vw,3.5rem)] font-medium leading-none tabular-nums text-[#ece7de]"
              style={{ letterSpacing: "-0.022em" }}
            >
              {m.value}
            </span>
            {/* the re-drawing rule */}
            <span aria-hidden className="mt-4 block h-px overflow-hidden">
              <span
                className="mk-tick-underline block h-px w-full"
                style={{
                  background: "rgba(236,231,222,0.28)",
                  ...ambientLoop(i, { base: 10.4, spread: 4.7 }),
                }}
              />
            </span>
            <span className="mx-auto mt-4 block max-w-[26ch] text-[14px] leading-[1.5] text-[#8a857c] md:mx-0">
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </MarketingSection>
  );
}
