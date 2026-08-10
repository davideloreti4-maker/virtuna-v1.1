import { Section } from "../section";
import { Reveal } from "../reveal";

/**
 * The problem — the emotional hook for cold traffic.
 *
 * No cards. Three prose boxes was the page at its most templated: this is a
 * STATEMENT section, and it works as architecture — the headline carries the
 * emotion, and three hairline-divided columns land one short blow each. Total
 * copy is under forty words; the reader should clear this section in five
 * seconds, angrier than they arrived.
 * (All copy on this page is placeholder — shaped for layout, to be replaced.)
 */

const PAINS = [
  {
    title: "Analytics grade you after",
    line: "Every number arrives once the outcome is locked.",
  },
  {
    title: "Three seconds decide",
    line: "Most videos die in the open — and nothing says why.",
  },
  {
    title: "Flops teach the feed",
    line: "A bad guess costs the reach of the next ten posts.",
  },
] as const;

export function Problem() {
  return (
    <Section
      tone="alt"
      eyebrow="The problem"
      title={
        <>
          You post. You pray.
          <br />
          You refresh.
        </>
      }
    >
      <div className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[color:var(--lp-line)]">
        {PAINS.map((pain, i) => (
          <Reveal key={pain.title} delay={i * 70} className="md:px-8 md:first:pl-0 md:last:pr-0">
            <h3 className="lp-h3">{pain.title}</h3>
            <p className="lp-card-body mt-2.5 max-w-[34ch] text-[color:var(--lp-fg-3)]">
              {pain.line}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
