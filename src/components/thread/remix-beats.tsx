"use client";

/**
 * RemixBeats — the beat-by-beat shoot rows on a remix card (phase 1, text only).
 *
 * Phase 3 swaps the leading column for a frame, phase 4 for a clip. The row structure is what
 * those phases upgrade, so it is built as a list of rows from the start rather than as prose.
 *
 * NO ACCENT ANYWHERE, and this is not a styling preference. The dosage rule is LOCKED at "at most
 * one accent element visible at a time, and zero is the norm"; the card already spends its one on
 * the Borrowed chip. That includes the fabricated-sheet notice below — a warning is exactly the
 * kind of thing that invites a colour, and it gets none.
 *
 * FOUR states, not two:
 *   no row / read failed  → render nothing (the card is exactly what it was before this lane)
 *   `beats: []`           → render nothing (emptyBlueprint — an honest "no video")
 *   `from_fixed_buckets`  → say we could not read the timing, and print no beats
 *   otherwise             → the sheet
 */
import { useEffect, useState } from "react";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import { SECTION_LABEL } from "./card-primitives";

interface Payload {
  script: AdaptedBeat[][];
  blueprint: SourceBlueprint;
}

const HEADING = "Shoot it beat by beat";

/** The block wrapper — the same border-t / px-4 / py-3 zone as the production block above it. */
const ZONE = "border-t border-white/[0.06] px-4 py-3";

export function RemixBeats({
  blueprintId,
  variantIndex,
  initialData,
}: {
  blueprintId: string;
  /**
   * WHICH ranked variant this card is. One `remix_blueprints` row serves ALL of a run's cards —
   * one source video, one skeleton, N adapted scripts — so the id alone does not identify a
   * script. The caller reads it off the block; it is never assumed to be 0.
   */
  variantIndex: number;
  /**
   * Data supplied directly instead of fetched — the /dev/cards path, and nothing else.
   *
   * This component fetches its own payload by id, which made the shoot sheet UNVIEWABLE in the
   * gallery: the fixture has no blueprintId, so the effect never ran and the whole section
   * vanished silently. Measured live 2026-08-12 — /dev/cards → Skills → Remix rendered exactly
   * the pre-lane card, with no sign anything was missing. That is precisely the drift the gallery
   * exists to prevent, happening to the gallery itself.
   *
   * Production never passes this: the card mounts with `blueprintId` alone and the fetch below is
   * unchanged. Deliberately NOT a "fetch, but seed it" cache — a gallery that quietly hits the API
   * renders differently signed-in than signed-out, which is the opposite of what a fixture is for.
   */
  initialData?: Payload;
}) {
  const [fetched, setFetched] = useState<Payload | null>(null);

  useEffect(() => {
    if (initialData) return; // injected — never touch the network
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/remix/blueprint/${encodeURIComponent(blueprintId)}`);
        if (!res.ok) return; // silent: a missing sheet is not an error state ON THE CARD.
        const json = (await res.json()) as Payload;
        if (alive) setFetched(json);
      } catch {
        /* a beat list that cannot load simply does not render */
      }
    })();
    return () => {
      alive = false;
    };
  }, [blueprintId, initialData]);

  const data = initialData ?? fetched;
  if (!data) return null;

  const { blueprint } = data;

  // FABRICATED — `buildFixedBuckets` produced this grid, so it describes no video at all. Its
  // beats carry evenly spaced times that look like a real read, and the duration behind them is
  // very likely `assembleOmniOutput`'s hard-coded 30s fallback. Adapt still wrote plausible lines
  // against those times, which is what makes printing them worse than printing nothing: the sheet
  // would read as a confident, timed perception of a video nobody watched.
  //
  // `=== true`, never `!blueprint.from_fixed_buckets`: the jsonb is cast without a zod parse, so
  // the field can be absent on a row written before the flag existed. Absent renders the sheet —
  // there are zero such rows, and suppressing every sheet on a missing boolean would be a much
  // larger failure than the one this guards.
  if (blueprint.from_fixed_buckets === true) {
    return (
      <div data-beats-unavailable className={ZONE}>
        <p className={SECTION_LABEL}>{HEADING}</p>
        <p className="mt-1.5 text-label leading-relaxed text-foreground-muted">
          We couldn&rsquo;t read this video&rsquo;s timing, so there&rsquo;s no beat sheet for this
          one.
        </p>
      </div>
    );
  }

  const beats = blueprint.beats ?? [];
  const script = data.script?.[variantIndex] ?? [];
  if (beats.length === 0 || script.length === 0) return null;

  return (
    <div data-beats className={ZONE}>
      <p className={SECTION_LABEL}>{HEADING}</p>
      <ol className="mt-2 flex flex-col gap-3">
        {beats.map((beat) => {
          // Nothing in the schema ties a script entry's `index` to a real beat (`ScriptZodSchema`
          // is `.min(1).max(MAX_BEATS)` over `index: z.number().int().min(0)`), so a short or
          // shifted script is a live possibility. A missing row would leave a silent hole in the
          // timeline — the creator shoots a video with a gap in the middle and nothing says why.
          const line = script.find((s) => s.index === beat.index);
          return (
            <li key={beat.index} className="flex flex-col gap-1">
              {/* The timecode sits BESIDE the role, never the label alone: buildBlueprint can
                  legitimately emit a 0–5s beat still labelled `hook` on a degenerate grid, and
                  the times are what make that self-describing rather than a misstatement. */}
              <p className="text-label text-foreground-muted">
                {beat.t_start.toFixed(1)}–{beat.t_end.toFixed(1)}s · {beat.role.toUpperCase()}
                {cutsSuffix(beat.cuts)}
              </p>
              {line ? (
                <>
                  {line.spoken ? (
                    <p className="text-body leading-relaxed text-foreground-secondary">
                      &ldquo;{line.spoken}&rdquo;
                    </p>
                  ) : null}
                  {line.on_screen_text ? (
                    <p className="text-label text-foreground-muted">
                      On screen: {line.on_screen_text}
                    </p>
                  ) : null}
                  <p className="text-label text-foreground-muted">Shot: {line.shot}</p>
                  {/* The repair is the only line on a beat that carries a DIAGNOSIS — the source
                      sagged here and this is what to do differently. It shipped in the same
                      `text-label text-foreground-muted` as "On screen:" and "Shot:", so the one
                      earned insight per beat read as one more boilerplate row (measured on the
                      real fixture, 2026-08-13). A left rule + a lit label separates it without
                      spending colour — the dosage rule is LOCKED, and a repair note is exactly
                      the kind of thing that invites an accent and gets none. */}
                  {line.repair ? (
                    <p className="border-l border-white/[0.10] pl-2 text-label leading-relaxed text-foreground-muted">
                      <span className="font-medium text-foreground-secondary">Fix the source&rsquo;s mistake:</span>{' '}
                      {line.repair}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-label text-foreground-muted">
                  No line was written for this beat.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * How many cuts the original made INSIDE this beat.
 *
 * `BlueprintBeat.cuts` is `group.length` — the count of source cells merged into the beat, which
 * its own docstring already flags as one more than the number of boundaries. N cells have N-1
 * cuts between them, and that is what a creator matching the original's pacing needs. Printing
 * `cuts` verbatim overstates every merged beat by one.
 */
function cutsSuffix(cells: number): string {
  const cuts = cells - 1;
  if (cuts < 1) return "";
  return ` · ${cuts} cut${cuts === 1 ? "" : "s"}`;
}
