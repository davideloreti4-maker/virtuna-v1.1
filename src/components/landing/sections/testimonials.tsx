import { Card, Section } from "../section";
import { Reveal } from "../reveal";
import { Slot } from "../slot";

/**
 * Testimonial wall — nine voices, two of them video.
 *
 * CSS columns, not grid: quotes at natural height pack like a wall of notes,
 * which reads as collected rather than commissioned. The two video slots break
 * the text rhythm at positions 2 and 6 so neither column becomes all-text.
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
  {
    kind: "quote",
    text: "My last three posts all held above 60% at the three-second mark. That has never happened in two years of posting.",
    name: "Placeholder Name",
    meta: "@placeholder · 56k followers",
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
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {WALL.map((item, i) => (
          <Reveal key={i} delay={(i % 3) * 60} className="mb-5 break-inside-avoid">
            {item.kind === "video" ? (
              <Slot variant="video" ratio="4 / 5" label={item.label} play="sm" />
            ) : (
              <Card className="p-6">
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
