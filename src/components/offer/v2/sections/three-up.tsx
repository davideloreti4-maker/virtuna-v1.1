/**
 * Three statements: the read, the room, the cut. The table of contents for §1.0–3.0 below.
 *
 * Each carries a small figure on its own orbit period (21.7s / 17.3s / 13.9s) — three loops
 * that can never march together. This is the section that would otherwise be three static
 * icons in a row, which is the exact texture the owner called AI trash, and it is also what
 * keeps the animation count alive in the gap between the logo wall and the first product
 * surface.
 *
 * ⚠️ Every number on this page is one of the four that exist: 500 dissected videos, 10 named
 * viewers, ~90s to a verdict, and the cited 231 → 183,000 receipt. Nothing here invents a
 * fifth. The copy states mechanism, not magnitude.
 */

import { MarketingSection, MarketingHeading } from "../marketing-shell";

interface Statement {
  index: string;
  title: string;
  body: string;
  orbit: string;
  /** Ring radii for the figure — distinct per card so the three do not read as clones. */
  rings: number[];
}

const STATEMENTS: readonly Statement[] = [
  {
    index: "1.0",
    title: "The read",
    body: "Your video is dissected frame by frame — every cut, every beat, scored against the corpus.",
    orbit: "mk-orbit-slow",
    rings: [26, 17],
  },
  {
    index: "2.0",
    title: "The room",
    body: "A room of viewer profiles watches it and reacts in character — who stays, who leaves, and when.",
    orbit: "mk-orbit-mid",
    rings: [30, 21, 12],
  },
  {
    index: "3.0",
    title: "The cut",
    body: "You get the second attention drops, the reason it drops there, and the one change that moves it.",
    orbit: "mk-orbit-fast",
    rings: [24, 14],
  },
];

function Figure({ orbit, rings }: { orbit: string; rings: number[] }) {
  return (
    <svg viewBox="0 0 72 72" className="h-16 w-16" aria-hidden>
      {/* Static ground ring — the orbit reads as motion only against something still. */}
      <circle cx="36" cy="36" r="33" fill="none" stroke="var(--mk-hairline)" strokeWidth="1" />
      <g className={orbit} style={{ transformOrigin: "36px 36px" }}>
        {rings.map((r, i) => (
          <circle
            key={r}
            cx={36 + r * Math.cos((i * 2 * Math.PI) / rings.length)}
            cy={36 + r * Math.sin((i * 2 * Math.PI) / rings.length)}
            r={i === 0 ? 3.2 : 2.1}
            fill="#ece7de"
            opacity={i === 0 ? 0.85 : 0.4}
          />
        ))}
      </g>
    </svg>
  );
}

export function ThreeUp() {
  return (
    <MarketingSection seam seamIndex={1}>
      <MarketingHeading
        eyebrow="What happens"
        title="Three surfaces, ninety seconds."
        sub="Every claim below is something the product renders. Scroll and you will see each one running."
      />
      {/*
        CARDS, not bare text. The first pass rendered these as three unbounded text columns on
        the page floor, and next to Attio's bordered panels it read as a document rather than a
        product page. A hairline and a lifted ground are what make three statements read as
        three OBJECTS — which is most of the difference between "designed" and "typed".
      */}
      <div className="mt-10 grid gap-4 md:mt-12 md:grid-cols-3">
        {STATEMENTS.map((s) => (
          <div
            key={s.index}
            className="flex flex-col rounded-[14px] p-6 md:p-7"
            style={{ border: "1px solid var(--mk-hairline)", background: "var(--mk-s1)" }}
          >
            <Figure orbit={s.orbit} rings={s.rings} />
            <div className="mt-6 flex items-baseline gap-2.5">
              <span className="font-mono text-[11.5px] font-semibold tracking-[0.16em] text-[#6d6961]">
                {s.index}
              </span>
              <h3 className="text-[19px] font-semibold text-[#ece7de]">{s.title}</h3>
            </div>
            <p className="mt-3 text-[15.5px] leading-[1.55] text-[#c2bdb4]">{s.body}</p>
          </div>
        ))}
      </div>
    </MarketingSection>
  );
}
