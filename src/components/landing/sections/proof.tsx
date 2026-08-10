import { Card, Section } from "../section";
import { Reveal } from "../reveal";
import { Slot } from "../slot";
import { Sparkline } from "../retention-curve";

/**
 * Proof — the stat bar and the result receipts, opening the trust act.
 *
 * The receipts are the signature's third appearance: the same retention curve,
 * reduced to a pair of sparklines — the first cut collapsing, the posted cut
 * holding. The delta arrow is one of the four sanctioned accent jobs; the
 * sparklines themselves stay cream/muted so the coral only marks the OUTCOME.
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
      {/* Stat bar — one hairline-divided row, figures in mono. Not cards: these
          are readings on the same instrument, and separating them into boxes
          would promote them to content. */}
      <Reveal>
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[color:var(--lp-line)] md:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={[
                "flex flex-col gap-1.5 px-7 py-6",
                i % 2 === 1 ? "border-l border-[color:var(--lp-line)]" : "",
                i >= 2 ? "border-t border-[color:var(--lp-line)] md:border-t-0" : "",
                i >= 1 ? "md:border-l md:border-[color:var(--lp-line)]" : "",
              ].join(" ")}
            >
              <span className="lp-mono text-[26px] leading-none text-[color:var(--lp-fg)]">
                {stat.value}
              </span>
              <span className="lp-eyebrow">{stat.label}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* The receipts. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
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

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[color:var(--lp-line)] p-3">
                  <div className="h-12">
                    <Sparkline tone="dropped" />
                  </div>
                  <p className="lp-eyebrow mt-2.5">First cut</p>
                  <p className="lp-mono mt-1 text-[13px] text-[color:var(--lp-fg-2)]">
                    {r.before} views
                  </p>
                </div>
                <div className="rounded-lg border border-[color:var(--lp-line)] p-3">
                  <div className="h-12">
                    <Sparkline tone="held" />
                  </div>
                  <p className="lp-eyebrow mt-2.5">Posted cut</p>
                  <p className="lp-mono mt-1 text-[13px] text-[color:var(--lp-fg)]">
                    {r.after} views
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
