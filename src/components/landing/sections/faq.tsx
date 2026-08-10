import { Section } from "../section";
import { Reveal } from "../reveal";

/**
 * FAQ — native <details>/<summary>, zero client JS.
 *
 * The accordion is the browser's own; CSS handles the open/close chevron. A
 * JS accordion here would buy single-open behaviour at the cost of a client
 * boundary, and single-open is a preference, not a requirement.
 *
 * Layout: title column left, questions right — the two-column split keeps the
 * heading visible while a reader works down the list, and it is the one
 * section whose content is taller than its title.
 */

const FAQS = [
  {
    q: "What exactly do I get for $1?",
    a: "The entire product for 3 days: 50 credits, every skill, your own audience personas. A full video read costs 10 credits, so the trial covers five complete reads — enough to test a real week of content.",
  },
  {
    q: "How does the simulation work?",
    a: "Maven builds a panel of viewers modelled on your niche and has them watch your video second by second. Their attention is scored continuously — where it breaks, you get a timestamp, a reason, and a fix.",
  },
  {
    q: "Which platforms does it cover?",
    a: "TikTok, Instagram Reels and YouTube Shorts. Short vertical video behaves the same way everywhere: the first seconds decide, and that's what Maven measures.",
  },
  {
    q: "What happens after the 3 days?",
    a: "Your trial converts to the plan you picked — $49/mo unless you chose otherwise — and your credits refill. Cancel before day 3 and the total cost stays $1.",
  },
  {
    q: "Do I need to connect my account?",
    a: "No. Paste a link or upload a draft — Maven never needs your login, and it works on videos you haven't posted yet. That's the point.",
  },
  {
    q: "What's a credit?",
    a: "The meter for every paid action, published as a price list: a full video read is 10, a script is 2, a hooks pack is 1. No hidden math — your balance is a number you can count.",
  },
  {
    q: "How do I cancel?",
    a: "Two taps in settings, any time before renewal. No email required, no retention flow, no \"are you sure\" gauntlet.",
  },
  {
    q: "Does it work for small accounts?",
    a: "Small accounts benefit most — when you only post twice a week, one saved flop is a meaningful share of your month. The simulation doesn't care about your follower count, only your content.",
  },
] as const;

export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.7fr]">
        <Reveal>
          <p className="lp-eyebrow">FAQ</p>
          <h2 className="lp-h2 mt-5 max-w-[12ch]">Fair questions</h2>
          <p className="lp-body mt-5 max-w-[36ch]">
            The short version: $1, three days, everything unlocked, cancel in
            two taps.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="flex flex-col">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group border-b border-[color:var(--lp-line)] first:border-t"
              >
                {/* Row hover: a whisper of fill, bleeding past the text column
                    into the gutter — the references' list rows all answer the
                    cursor; a bare colour change on 15px text is too quiet to
                    register as an affordance. */}
                <summary className="-mx-4 flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg px-4 py-5 transition-colors duration-200 hover:bg-[rgba(236,231,222,0.03)] [&::-webkit-details-marker]:hidden">
                  <span className="text-[15px] font-medium text-[color:var(--lp-fg)]">
                    {item.q}
                  </span>
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-[color:var(--lp-fg-3)] transition-transform duration-200 group-open:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="lp-body max-w-[62ch] pb-6">{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
