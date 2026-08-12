import { Card, Section } from "../section";
import { Reveal } from "../reveal";
import { Slot } from "../slot";
import { SparklinePair } from "../retention-curve";

/**
 * Proof — the stat bar and the result receipts, opening the trust act.
 *
 * The receipts carry the signature curve: the first cut collapsing, the posted
 * cut holding, overlaid in one panel. The delta arrow is one of the three
 * sanctioned accent jobs; the sparklines themselves stay cream/muted so the
 * coral only marks the OUTCOME.
 *
 * (All figures and handles are placeholder — shaped for layout.)
 */

const STATS = [
  { value: "2.4M", label: "videos simulated" },
  { value: "18,000", label: "creators on board" },
  { value: "+37%", label: "median retention lift" },
  { value: "90s", label: "draft to verdict" },
] as const;

const RECEIPTS = [
  {
    handle: "@placeholder_one",
    niche: "Fitness",
    before: "12.4k",
    after: "348k",
    delta: "28×",
  },
  {
    handle: "@placeholder_two",
    niche: "Cooking",
    before: "8.1k",
    after: "96k",
    delta: "12×",
  },
  {
    handle: "@placeholder_three",
    niche: "Personal finance",
    before: "22k",
    after: "1.1M",
    delta: "50×",
  },
] as const;

function DeltaArrow() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-[color:var(--lp-accent)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function Proof() {
  return (
    <Section
      id="proof"
      eyebrow="Results"
      title="Receipts, not promises"
      lead="The same video, before and after the read."
      wide
    >
      {/* Stat band — a hairline BAND, not a boxed row: top and bottom rules
          with the four readings divided between them, figures large. The boxed
          version promoted the stats to a card; a band leaves them as readings
          on the page's own surface, which is the Linear register. */}
      <Reveal>
        <div className="grid grid-cols-2 border-y border-[color:var(--lp-line)] md:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={[
                "flex flex-col gap-2 px-2 py-7 md:px-8 md:py-9",
                i % 2 === 1 ? "border-l border-[color:var(--lp-line)] pl-6" : "",
                i >= 2 ? "border-t border-[color:var(--lp-line)] md:border-t-0" : "",
                i >= 1 ? "md:border-l md:border-[color:var(--lp-line)]" : "",
                i === 0 ? "md:pl-2" : "",
              ].join(" ")}
            >
              <span className="lp-mono text-[30px] leading-none text-[color:var(--lp-fg)] md:text-[36px]">
                {stat.value}
              </span>
              <span className="lp-eyebrow">{stat.label}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* The receipts. ONE chart per card, both cuts overlaid — the gap
          between the lines is the receipt. */}
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {RECEIPTS.map((r, i) => (
          <Reveal key={r.handle} delay={i * 70}>
            <Card interactive className="h-full p-6">
              <div className="flex items-center gap-3.5">
                <Slot variant="video" ratio="9 / 16" className="w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="lp-mono truncate text-[13px] text-[color:var(--lp-fg)]">
                    {r.handle}
                  </p>
                  <p className="lp-eyebrow mt-1">{r.niche}</p>
                </div>
                <span className="flex items-center gap-1">
                  <DeltaArrow />
                  <span className="lp-mono text-[17px] font-medium text-[color:var(--lp-fg)]">
                    {r.delta}
                  </span>
                </span>
              </div>

              <div className="mt-5 rounded-lg border border-[color:var(--lp-line)] p-3.5">
                <div className="h-16">
                  <SparklinePair />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--lp-line)] pt-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-px w-3.5 shrink-0"
                      style={{ background: "rgba(138,133,124,0.7)" }}
                    />
                    <span className="lp-mono truncate text-[11px] text-[color:var(--lp-fg-3)]">
                      first cut · {r.before}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-px w-3.5 shrink-0"
                      style={{ background: "rgba(236,231,222,0.8)" }}
                    />
                    <span className="lp-mono truncate text-[11px] text-[color:var(--lp-fg)]">
                      posted · {r.after}
                    </span>
                  </span>
                </div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
