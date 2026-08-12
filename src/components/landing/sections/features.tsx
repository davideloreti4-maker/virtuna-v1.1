import { Card, Section } from "../section";
import { Reveal } from "../reveal";
import { Slot } from "../slot";
import { Sparkline } from "../retention-curve";
import { VerdictSketch } from "../sketch";

/**
 * What you get — the capability bento.
 *
 * Each cell leads with a DATA ARTIFACT — a score readout, an edit list, a
 * persona roster, an A/B pair — and carries at most one short line of prose.
 * This is the Linear/Attio register: the page doesn't describe the product,
 * it leaves product residue lying around. The artifacts are all hairline +
 * cream; no accent (the budget's four jobs don't include furniture).
 */

/** Hook score: a big mono readout with its meter. */
function HookArtifact() {
  return (
    <div className="flex items-center gap-4">
      <span className="lp-mono text-[34px] leading-none text-[color:var(--lp-fg)]">
        87
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-[rgba(236,231,222,0.08)]">
          <div className="h-full w-[87%] rounded-full bg-[rgba(236,231,222,0.55)]" />
        </div>
        <span className="lp-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--lp-fg-3)]">
          Hook · strong open
        </span>
      </div>
    </div>
  );
}

/** The cut list: three edit rows, timestamp → instruction. */
function CutListArtifact() {
  const cuts = [
    { at: "0:00", fix: "Trim the cold open", chip: "−1.8s" },
    { at: "0:04", fix: "Front-load the reveal", chip: "move" },
    { at: "0:11", fix: "Cut example two", chip: "−3.2s" },
  ] as const;
  return (
    <div className="flex flex-col">
      {cuts.map((cut) => (
        <div
          key={cut.at}
          className="flex items-center gap-3 border-t border-[color:var(--lp-line)] py-2 first:border-t-0"
        >
          <span className="lp-mono text-[11px] text-[color:var(--lp-fg-3)]">
            {cut.at}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--lp-fg-2)]">
            {cut.fix}
          </span>
          <span className="lp-chip">{cut.chip}</span>
        </div>
      ))}
    </div>
  );
}

/** The room: a dot roster plus its tuning chips. */
function PersonaArtifact() {
  const tones = [0.18, 0.1, 0.14, 0.08, 0.16, 0.1, 0.12, 0.08];
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex -space-x-1.5">
        {tones.map((o, i) => (
          <span
            key={i}
            className="h-6 w-6 rounded-full ring-2 ring-[color:var(--lp-card)]"
            style={{ background: `rgba(236,231,222,${o})` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="lp-chip">fitness</span>
        <span className="lp-chip">US · 24–34</span>
        <span className="lp-chip">scrolls at night</span>
      </div>
    </div>
  );
}

/** Cut A vs cut B: the same video, re-run. */
function RemakeArtifact() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {(["dropped", "held"] as const).map((tone, i) => (
        <div
          key={tone}
          className="rounded-lg border border-[color:var(--lp-line)] p-2.5"
        >
          <div className="h-9">
            <Sparkline tone={tone} />
          </div>
          <span className="lp-mono mt-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--lp-fg-3)]">
            {i === 0 ? "Cut A" : "Cut B · posted"}
          </span>
        </div>
      ))}
    </div>
  );
}

const SMALL = [
  {
    title: "Hook score",
    line: "The first three seconds, graded alone.",
    artifact: <HookArtifact />,
  },
  {
    title: "The fix, as a cut list",
    line: "A written edit — not a vibe.",
    artifact: <CutListArtifact />,
  },
  {
    title: "Personas in your niche",
    line: "The room is tuned to who you post for.",
    artifact: <PersonaArtifact />,
  },
  {
    title: "Test the remake too",
    line: "Re-run the new cut until the curve holds.",
    artifact: <RemakeArtifact />,
  },
] as const;

export function Features() {
  return (
    <Section
      tone="alt"
      eyebrow="What you get"
      title="An edit room that knows your audience"
      wide
    >
      <div className="flex flex-col gap-5">
        {/* The focal cell — full-width horizontal split, so the quartet below
            forms an even row with no orphaned grid holes. */}
        <Reveal>
          <Card className="grid items-center gap-8 p-7 md:grid-cols-[1fr_1.3fr] md:p-9">
            <div>
              <h3 className="lp-h3">The retention read</h3>
              <p className="lp-card-body mt-3 max-w-[40ch]">
                Every second scored — the exact frame attention breaks, and what
                they saw right before they left.
              </p>
            </div>
            <Slot
              variant="window"
              ratio="16 / 9"
              label="Animation · retention read"
              duration="0:20"
              play="sm"
              className="lp-elevate"
            >
              <VerdictSketch />
            </Slot>
          </Card>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {SMALL.map((cell, i) => (
            <Reveal key={cell.title} delay={60 + i * 60}>
              <Card interactive className="flex h-full flex-col justify-between gap-6 p-6">
                <div>
                  <h3 className="lp-card-title">{cell.title}</h3>
                  <p className="lp-card-body mt-1.5 text-[color:var(--lp-fg-3)]">
                    {cell.line}
                  </p>
                </div>
                {cell.artifact}
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
