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
import { useCallback, useEffect, useState } from "react";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import { SECTION_LABEL } from "./card-primitives";
import { CoverFill } from "@/components/primitives/CoverFill";
import { RemixSourceViewer } from "./remix-source-viewer";
import { RemixSourceEmbed } from "./remix-source-embed";
import { useRemixRefresh } from "@/lib/remix-refresh-context";

interface Payload {
  script: AdaptedBeat[][];
  blueprint: SourceBlueprint;
  /**
   * PHASE 3 — `{ beatIndex → signed frame URL }`, one real still from the SOURCE video per beat.
   *
   * Absent or partial is the NORMAL case, not a failure: every sheet written before phase 3 has
   * none, extraction is capped and budgeted, and a frame that fails to cut is simply skipped. The
   * row renders a play-tile in that slot, so the sheet never degrades into broken boxes and the
   * pre-phase-3 sheet keeps rendering byte-identically.
   */
  frames?: Record<number, string>;
  /**
   * The SOURCE VIEWER's strip — `{ gridIndex → signed frame URL }` on an even time grid, a
   * different sampling from `frames` above and a different storage keyspace (`<id>/scrub/`).
   *
   * Absent is the normal case for every sheet written before this lane, and the viewer simply does
   * not render — the sheet is then byte-identical to what it was.
   */
  scrubFrames?: Record<number, string>;
  /**
   * The source post URL (`remix_blueprints.source_video_id`). Drives the embed's platform.
   * Deliberately not the request's `platform` flag, which is hardcoded "tiktok" on every launch
   * while 63% of the corpus is Instagram.
   */
  sourceUrl?: string | null;
  /**
   * PHASE 4 — `{ beatIndex → signed clip URL }` for the source viewer's stage. Absent for every
   * pre-lane sheet and whenever cutting failed; the stage then plays the flipbook, unchanged.
   */
  clips?: Record<number, string>;
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

  // The playhead's beat lives HERE, not in the viewer, because the lit row is here. The viewer
  // stays free of beat semantics and the row list stays free of scrub mechanics; each is
  // understandable and testable without the other.
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  // Identity-stable so the viewer's onActiveBeatChange effect does not re-fire every render.
  const onActiveBeatChange = useCallback((i: number | null) => setActiveBeat(i), []);

  // Phase 5 (Task 2): the refresh channel. This card fetches once on mount and the thread reload
  // never remounts it (positional keys), so a `revise_remix` write nobody re-fetches for didn't
  // happen on screen. `bump` is this sheet's latest nonce — 0 when it has never been revised, and
  // it belongs in the fetch effect's deps so a later bump is an explicit "refetch me" signal.
  const { counters } = useRemixRefresh();
  const bump = counters[blueprintId] ?? 0;

  useEffect(() => {
    // injected (/dev/cards) — never touch the network UNLESS a revise bumped this sheet, so a
    // gallery-injected card also refetches after a revise instead of showing the stale fixture.
    if (initialData && bump === 0) return;
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
  }, [blueprintId, initialData, bump]);

  // `fetched` wins once it exists, not `initialData` — a bump-triggered refetch must not stay
  // shadowed by the fixture it was told is now stale (phase 5, the refresh channel). Behavior-
  // identical for every OTHER path: with bump 0 and initialData present the fetch effect never
  // runs, so `fetched` stays null and initialData still shows through the `??`; production never
  // sets initialData, so this side is always null and `fetched` was already the only source.
  const data = fetched ?? initialData;
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

  // Is there a playhead at all? Only a real strip creates one — an embed on its own does not, so
  // rows must not become clickable or litable just because the source has a watchable URL.
  const hasViewer = Object.keys(data.scrubFrames ?? {}).length > 0 && blueprint.duration_s > 0;

  return (
    <div data-beats className={ZONE}>
      <p className={SECTION_LABEL}>{HEADING}</p>

      {/* THE SOURCE VIEWER — scrub the source's own stills, and watch it with sound.
          Sits INSIDE the shoot-sheet block, not at the top of the card, because the whole point
          is that the beat row it lights is on screen while you scrub. The card's SourceStrip is
          ~1,400px above these rows; a playhead up there would light a row nobody can see.
          Renders nothing without frames, which is every sheet written before this lane. */}
      {hasViewer || data.sourceUrl ? (
        <div className="mt-2.5 flex flex-col gap-2.5">
          <RemixSourceViewer
            scrubFrames={data.scrubFrames ?? {}}
            beats={beats}
            durationS={blueprint.duration_s}
            onActiveBeatChange={onActiveBeatChange}
            seekToSec={seekToSec}
            clips={data.clips ?? {}}
          />
          <RemixSourceEmbed sourceUrl={data.sourceUrl} />
        </div>
      ) : null}

      <ol className="mt-2.5 flex flex-col gap-3">
        {beats.map((beat) => {
          // Nothing in the schema ties a script entry's `index` to a real beat (`ScriptZodSchema`
          // is `.min(1).max(MAX_BEATS)` over `index: z.number().int().min(0)`), so a short or
          // shifted script is a live possibility. A missing row would leave a silent hole in the
          // timeline — the creator shoots a video with a gap in the middle and nothing says why.
          const line = script.find((s) => s.index === beat.index);
          const frame = data.frames?.[beat.index];
          // Lit when the playhead is inside this beat. A left rule + brighter text, never a hue:
          // the dosage rule is LOCKED and the card already spends its one colour on the Borrowed
          // chip. `hasViewer` gates the whole affordance so a pre-lane sheet gains no dead rule.
          const lit = hasViewer && activeBeat === beat.index;
          return (
            <li
              key={beat.index}
              data-beat-index={beat.index}
              data-beat-active={lit || undefined}
              className={`flex gap-3 rounded-sm border-l-2 pl-2 transition-colors ${
                lit ? "border-white/[0.24]" : "border-transparent"
              } ${hasViewer ? "cursor-pointer" : ""}`}
              // Clicking a row moves the playhead to that beat. The reciprocity is what makes the
              // strip and the sheet read as one instrument rather than two widgets sharing a card.
              // Not a <button>: the row holds its own copy affordances and quoted text a reader
              // needs to select, and wrapping selectable prose in a button breaks both.
              onClick={hasViewer ? () => setSeekToSec(beat.t_start) : undefined}
            >
              {/* PHASE 3 — the source's own frame for this beat, in a 9:16 tower beside the
                  instruction. This is what "show me the video" actually wanted: not one cover at
                  the top of the card, but the image the creator is being told to recreate, next
                  to the words telling them to recreate it.

                  ALWAYS rendered, even with no frame — the slot is what makes the sheet read as a
                  timeline rather than a list, and CoverFill degrades to a play-tile so a missing
                  or expired frame is never a broken box. Pre-phase-3 sheets simply show tiles. */}
              {/* `self-start` is load-bearing, not alignment taste. The row is a flex container
                  whose `align-items` computes to `stretch`, and a stretched flex item has its
                  cross-size FORCED — which overrides `aspect-ratio`, because that only derives a
                  height while the height is `auto`. Without it the frame is 44px wide and as tall
                  as the row: measured 44x145 and 44x202 on a real 8-beat sheet (ratios 0.30 and
                  0.22 against the 0.563 this asks for), so every still was vertically stretched by
                  a different amount. Invisible until real copy made the rows tall — the fixture's
                  short lines happened to keep the rows near the natural height. */}
              <span className="relative mt-0.5 block aspect-[9/16] w-11 shrink-0 self-start overflow-hidden rounded border border-white/[0.06]">
                <CoverFill coverUrl={frame} playSize={12} alt="" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
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
              </div>
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
