import { Card, Section } from "../section";
import { Reveal } from "../reveal";
import { Slot } from "../slot";

/**
 * Testimonial wall — one pull-quote on a stage, then eight voices, two of
 * them video.
 *
 * CSS columns, not grid: quotes at natural height pack like a wall of notes,
 * which reads as collected rather than commissioned. The two video slots
 * break the text rhythm so neither column becomes all-text. The strongest
 * quote is PROMOTED above the wall in display type — a wall where every
 * voice is the same size has no headline moment.
 * (All quotes, names and counts are placeholder — shaped for layout.)
 */

interface Quote {
  kind: "quote";
  text: string;
  name: string;
  meta: string;
}
interface Video {
  kind: "video";
  label: string;
}

const WALL: ReadonlyArray<Quote | Video> = [
  {
    kind: "quote",
    text: "First read told me my hook was dying at 1.8 seconds. Re-cut the open — same video did 40× my average.",
    name: "Placeholder Name",
    meta: "@placeholder · 214k followers",
  },
  { kind: "video", label: "Video testimonial · creator" },
  {
    kind: "quote",
    text: "The scary part is how specific it is. Not \"improve your pacing\" — it named the exact sentence where people left.",
    name: "Placeholder Name",
    meta: "@placeholder · 89k followers",
  },
  {
    kind: "quote",
    text: "Paid the dollar out of curiosity. Cancelled my editor's guesswork instead.",
    name: "Placeholder Name",
    meta: "@placeholder · 132k followers",
  },
  {
    kind: "quote",
    text: "Every client draft goes through it before delivery. Defending a creative call vs proving one.",
    name: "Placeholder Name",
    meta: "Placeholder Agency · 40 accounts",
  },
  { kind: "video", label: "Video testimonial · creator" },
  {
    kind: "quote",
    text: "It caught a dead 4 seconds in the middle I'd watched fifty times and never seen.",
    name: "Placeholder Name",
    meta: "@placeholder · 310k followers",
  },
  {
    kind: "quote",
    text: "The trial pays for itself if it saves you one bad post. It saved me three in the first week.",
    name: "Placeholder Name",
    meta: "@placeholder · 71k followers",
  },
];

export function Testimonials() {
  return (
    <Section
      tone="alt"
      eyebrow="Creators"
      title="Loved by people who post every day"
      wide
    >
      {/* The pull-quote — ONE voice promoted above the wall, in display type.
          A wall of same-size cards has no headline moment; every reference
          page gives its strongest quote a stage. Grotesque, not serif: the
          serif budget is spent. */}
      <Reveal>
        <figure className="mx-auto mb-14 max-w-3xl text-center md:mb-16">
          <blockquote
            className="text-[24px] font-medium leading-[1.3] tracking-[-0.015em] text-[color:var(--lp-fg)] md:text-[30px]"
            style={{ fontFamily: "var(--lp-font-display)" }}
          >
            &ldquo;My last three posts all held above 60% at the three-second
            mark. That has never happened in two years of posting.&rdquo;
          </blockquote>
          <figcaption className="mt-6 flex items-center justify-center gap-3">
            <Slot variant="avatar" className="h-9 w-9 shrink-0" />
            <span className="text-[13px] font-medium text-[color:var(--lp-fg)]">
              Placeholder Name
            </span>
            <span className="lp-mono text-[11px] text-[color:var(--lp-fg-3)]">
              @placeholder · 56k followers
            </span>
          </figcaption>
        </figure>
      </Reveal>

      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {WALL.map((item, i) => (
          <Reveal key={i} delay={(i % 3) * 60} className="mb-5 break-inside-avoid">
            {item.kind === "video" ? (
              <Slot variant="video" ratio="3 / 4" label={item.label} play="sm" />
            ) : (
              <Card interactive className="p-6">
                <p className="text-[15px] leading-[1.6] text-[color:var(--lp-fg-2)]">
                  &ldquo;{item.text}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <Slot variant="avatar" className="h-9 w-9 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[color:var(--lp-fg)]">
                      {item.name}
                    </p>
                    <p className="lp-mono mt-0.5 truncate text-[11px] text-[color:var(--lp-fg-3)]">
                      {item.meta}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
