"use client";

/**
 * PersonaAudienceFrame — the Audience tab of the v8 verdict report at its PERSONAS-ONLY grade
 * (a drop's cached read, or a fired run whose Stage-2 projection came back null).
 *
 * Mock §6 anatomy: verdict · ten faces (lit = stopped) · why they stopped / why they scrolled ·
 * the fix. The counts beside each group head are counts of PEOPLE — real tallies of the ten —
 * not the mock's coded-reason "×4", which no producer computes for a Flash text run.
 *
 * The full <PopulationFrame> is deliberately NOT used at this grade: its terrain, pools and
 * "1,000 simulated" strip describe a Stage-2 projection that does not exist here, and inventing
 * one to fill the slot is exactly the fabrication the honesty spine forbids. When a run DOES
 * carry a population, the report renders PopulationFrame through the normal template path.
 *
 * ZERO accent (locked) — cream on charcoal; the loss reads by position and by label, never by hue.
 */

import { TONE } from "@/components/audience-lens/v2/AmbientDetail";
import { Card, CardHead, SURFACE } from "@/components/audience-lens/v2/rail-kit";
import type { ReportRead, ReportVoice } from "@/lib/surfaces/v8-report";

function Faces({ stop, total }: { stop: number; total: number }) {
  return (
    <div className="mt-3.5 flex gap-[6px]">
      {Array.from({ length: total }, (_, i) => {
        const lit = i < stop;
        return (
          <span
            key={i}
            data-testid={`report-face-${i}`}
            data-lit={lit ? "true" : "false"}
            aria-hidden
            className="h-[26px] flex-1 rounded-[6px]"
            style={{ background: lit ? "rgba(236,231,222,.30)" : "rgba(236,231,222,.07)" }}
          />
        );
      })}
    </div>
  );
}

function VoiceGroup({
  id,
  title,
  voices,
  count,
}: {
  id: "stopped" | "scrolled";
  title: string;
  voices: ReportVoice[];
  count: number;
}) {
  // Nobody in this group spoke ⇒ no header. An empty section is a promise of evidence we
  // cannot keep, and the group's own count is already on the faces above.
  if (voices.length === 0) return null;
  return (
    <Card>
      <div data-testid={`report-group-${id}`}>
        <CardHead title={title} meta={`${count} of the room`} />
        <div className="mt-1">
          {voices.map((v, i) => (
            <div key={`${v.who}-${i}`} className="py-2">
              <div className="font-serif text-[13.5px] leading-[1.45]" style={{ color: TONE.dim }}>
                “{v.quote}”
              </div>
              <div className="mt-1 text-[11px]" style={{ color: TONE.faint }}>
                {v.who}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function PersonaAudienceFrame({
  read,
  onSteer,
}: {
  read: ReportRead;
  /** The tab's fix action feeds the thread as a steer (spec §2). Omit ⇒ no action rendered. */
  onSteer?: (steer: string) => void;
}) {
  const lost = read.total - read.stop;
  return (
    <div className="pt-4">
      <div className="rounded-[14px] p-4" style={{ background: SURFACE.figure }}>
        <div className="flex items-baseline gap-1.5">
          <span
            data-testid="report-verdict"
            className="text-[30px] font-light leading-none tracking-[-0.01em] tabular-nums"
            style={{ color: TONE.cream }}
          >
            {read.stop}/{read.total}
          </span>
          <span className="text-[13px]" style={{ color: TONE.faint }}>
            stopped scrolling
          </span>
        </div>
        <Faces stop={read.stop} total={read.total} />
      </div>

      <VoiceGroup id="stopped" title="Why they stopped" voices={read.stopped} count={read.stop} />
      <VoiceGroup id="scrolled" title="Why they scrolled" voices={read.scrolled} count={lost} />

      {/* The tab ends in a fix, and the fix feeds the thread as a steer (spec §2). It names the
          real number it is asking you to win back — never a projected gain, which would be a
          claim about a run that has not happened. */}
      {onSteer && lost > 0 ? (
        <button
          type="button"
          onClick={() => onSteer(`Rewrite the hook to win back the ${lost} who scrolled past.`)}
          className="mt-4 w-full rounded-lg border border-white/[0.06] bg-surface-elevated px-3 py-2.5 text-label font-medium text-foreground transition-colors hover:border-white/[0.10]"
        >
          Fix what lost them
        </button>
      ) : null}
    </div>
  );
}
