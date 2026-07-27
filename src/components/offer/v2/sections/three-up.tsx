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
      <div className="mt-16 grid gap-12 md:mt-20 md:grid-cols-3 md:gap-10">
        {STATEMENTS.map((s) => (
          <div key={s.index} className="flex flex-col items-center text-center md:items-start md:text-left">
            <Figure orbit={s.orbit} rings={s.rings} />
            <div className="mt-6 flex items-baseline gap-2.5">
              <span className="font-mono text-[11.5px] font-semibold tracking-[0.16em] text-[#6d6961]">
                {s.index}
              </span>
              <h3 className="text-[19px] font-semibold text-[#ece7de]">{s.title}</h3>
            </div>
            <p className="mt-3 max-w-[38ch] text-[15.5px] leading-[1.55] text-[#c2bdb4]">{s.body}</p>
          </div>
        ))}
      </div>
    </MarketingSection>
  );
}
