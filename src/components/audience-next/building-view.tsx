"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import { AudienceRing } from "@/components/result/audience-ring";
import { equalRing } from "@/components/result/running-ring";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AUDIENCE_RING, COVERS_SHOWN, type Face as FaceModel, type Whose } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, fromVideos, readCount } from "@/lib/audience-next/audience-words";
import { litWedgesOf, stepsOf, type BuildState } from "@/lib/audience-next/build-state";
import type { WedgeLook } from "@/lib/result/ring-layout";
import { cn } from "@/lib/utils";

import { Face } from "./face";

/**
 * A read while it runs, and its outcomes (spec 2026-11-25-audience, 3.6; the drawing's Building frame).
 * Presentational: the state comes in, the buttons are handlers.
 *
 *   Building your audience
 *   ( ten equal wedges; the face in the middle )   wedges light as the steps finish: 0, 3, 7, 10
 *   ● Reading your followers                      the server's own step names: done, now, next
 *   ◯ Watching your videos
 *   ○ Building your audience profile
 *   Keep this page open.
 *   [ From your videos · 12 read   ▯▯▯▯ ]         once the read has delivered videos
 *
 * No count of viewers, no percent, no time left: none of them is known while the read runs. After three
 * minutes one more line says it is taking longer. Once the audience is made (settling, done) the ring is
 * full and every step done while the page waits for the stream to close.
 *
 * Outcomes. Too little to read: the title, the sentence, then `Use general viewers` and the way to try
 * another (new; a creator who already has an audience in use gets only the way to try another, as the main
 * button: general viewers is not what they use), or the groups kept as they were and Close (again). Failed:
 * the sentence as an alert, Try again, then the quiet way to change what was typed (new: a mistyped handle
 * must not be a dead end) or Close (again).
 *
 * The focus: the view's title when it opens (the form's button that had it is gone) and when the outcome
 * is too little to read; Try again when the read failed.
 */

export interface BuildingViewProps {
  state: BuildState;
  slow: boolean;
  /** `new`: on `/audience/new`; `again`: an audience read again on its own page. */
  mode: "new" | "again";
  /** Whose videos the evidence card names; null: no card (a description has no account). */
  whose: Whose | null;
  /** The face's letter until the read delivers a picture. */
  initial: string;
  onTryAgain(): void;
  /** `Use general viewers`: for a creator with no audience in use; without it, the way to try another is the
   *  main button. */
  onUseGeneral?(): void;
  /** The way to try another: after too little to read, and (new) after a failure. */
  onTryAnother?(): void;
  /** `Try another account`, or for a description `Change the description`. */
  tryAnotherLabel?: string;
  onClose?(): void;
}

const S = AUDIENCE_STRINGS;
const WEDGES = 10;

/**
 * The global `h2` tracking and the app's focus outline are unlayered and beat a utility: set inline. The
 * heading takes the focus by script and is not a control, so it draws no outline (a box round it read as a
 * fault in the browser).
 */
const HEADING_STYLE: CSSProperties = { letterSpacing: "-0.03em", outline: "none" };
const HEADING = "text-[26px] font-[720] leading-[31px] text-foreground";

/** The ink buttons: full width, round (as the page's). */
const PILL = "w-full next:rounded-full";
const QUIET = "flex h-11 w-full items-center justify-center text-ui font-[620] text-foreground";

/** Ten equal wedges, the first `lit` full (clockwise from the top), the rest pale; the face in the middle. */
function BuildingRing({ lit, face }: { lit: number; face: FaceModel }) {
  const { layout } = equalRing(WEDGES, AUDIENCE_RING.r1, AUDIENCE_RING.R, 1000);
  const looks = useMemo(
    () => layout.wedges.map((w, i): WedgeLook => ({ on: i < lit ? w.dots.length : 0, coral: false, outline: false })),
    [layout, lit],
  );
  return (
    <div data-building-ring="" data-lit={lit} className="relative mx-auto shrink-0" style={{ width: layout.size, height: layout.size }}>
      <AudienceRing layout={layout} looks={looks} />
      <Face face={face} size={64} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}

/** A step's mark: done a filled check, now a ring, next a pale ring. */
function StepMark({ at }: { at: "done" | "now" | "next" }) {
  return (
    <svg aria-hidden width={20} height={20} viewBox="0 0 20 20" className={cn("shrink-0", at === "next" ? "text-foreground-muted opacity-60" : "text-foreground")}>
      {at === "done" ? (
        <>
          <circle cx={10} cy={10} r={10} fill="currentColor" />
          <path d="M6 10.4l2.7 2.6L14.2 7.5" fill="none" stroke="var(--color-surface)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <circle cx={10} cy={10} r={at === "now" ? 8.5 : 9.25} fill="none" stroke="currentColor" strokeWidth={at === "now" ? 3 : 1.5} />
      )}
    </svg>
  );
}

const STEP_WORD = { done: S.stepDone, now: S.stepNow, next: S.stepNext } as const;

/** A video's cover: decorative, and gone when it cannot be drawn (an address can expire). */
function Cover({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  // An image that failed before the page woke up fired its error before React listened for it.
  const failedEarly = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an address that expires, not a static asset
    <img ref={failedEarly} src={src} alt="" onError={() => setFailed(true)} className="h-[46px] w-[34px] shrink-0 rounded-md bg-surface-sunken object-cover" />
  );
}

function EvidenceCard({ whose, count, covers }: { whose: Whose; count: number; covers: readonly string[] }) {
  return (
    <Card data-evidence="" className="flex items-center gap-3 rounded-[22px] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-meta text-foreground-secondary">{fromVideos(whose)}</p>
        <p className="text-title font-[650] text-foreground tabular-nums">{readCount(count)}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {covers.slice(0, COVERS_SHOWN).map((src, i) => (
          // Two videos can share a cover address: the place keeps their keys apart.
          <Cover key={`${i}:${src}`} src={src} />
        ))}
      </div>
    </Card>
  );
}

type View = "building" | "thin" | "failed";
const viewOf = (state: BuildState): View => (state.phase === "thin" ? "thin" : state.phase === "failed" ? "failed" : "building");

export function BuildingView(props: BuildingViewProps) {
  const { state, slow, mode, whose, initial } = props;
  const view = viewOf(state);
  const titleId = useId();
  // What takes the focus when the view opens or turns to an outcome.
  const lead = useRef<HTMLElement | null>(null);
  const setLead = useCallback((el: HTMLElement | null) => {
    lead.current = el;
  }, []);
  useEffect(() => {
    lead.current?.focus();
  }, [view]);

  if (view === "thin") {
    return (
      <section data-building="thin" aria-labelledby={titleId} className="flex flex-col gap-2 pt-2">
        <h2 id={titleId} ref={setLead} tabIndex={-1} className={HEADING} style={HEADING_STYLE}>
          {S.thinTitle}
        </h2>
        <p className="break-words text-ui text-foreground-secondary">{state.sentence}</p>
        {mode === "again" && <p className="text-ui text-foreground-secondary">{S.keptAsWas}</p>}
        <div className="mt-4 flex flex-col gap-1">
          {mode === "new" && props.onUseGeneral ? (
            <>
              <Button type="button" variant="primary" size="lg" className={PILL} onClick={props.onUseGeneral}>
                {S.useGeneral}
              </Button>
              <button type="button" className={QUIET} onClick={props.onTryAnother}>
                {props.tryAnotherLabel ?? S.tryAnother}
              </button>
            </>
          ) : mode === "new" ? (
            <Button type="button" variant="primary" size="lg" className={PILL} onClick={props.onTryAnother}>
              {props.tryAnotherLabel ?? S.tryAnother}
            </Button>
          ) : (
            <Button type="button" variant="secondary" size="lg" className={PILL} onClick={props.onClose}>
              {S.close}
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (view === "failed") {
    return (
      <section data-building="failed" className="flex flex-col gap-4 pt-2">
        <p role="alert" className="break-words text-ui text-foreground">
          {state.sentence}
        </p>
        <div className="flex flex-col gap-1">
          <Button ref={setLead} type="button" variant="primary" size="lg" className={PILL} onClick={props.onTryAgain}>
            {S.tryAgain}
          </Button>
          {mode === "again" ? (
            <button type="button" className={QUIET} onClick={props.onClose}>
              {S.close}
            </button>
          ) : (
            props.onTryAnother && (
              <button type="button" className={QUIET} onClick={props.onTryAnother}>
                {props.tryAnotherLabel ?? S.tryAnother}
              </button>
            )
          )}
        </div>
      </section>
    );
  }

  const steps = stepsOf(state);
  const now = steps.find((step) => step.at === "now");
  const running = state.phase === "running";
  const evidence = state.evidence;
  return (
    <section data-building="running" aria-labelledby={titleId} className="flex flex-col gap-5 pt-2">
      <h2 id={titleId} ref={setLead} tabIndex={-1} className={HEADING} style={HEADING_STYLE}>
        {S.building}
      </h2>
      <BuildingRing lit={litWedgesOf(state)} face={{ initial, picture: evidence?.picture ?? null }} />
      <div className="flex flex-col gap-3 px-1">
        <ol aria-labelledby={titleId} className="flex flex-col gap-3">
          {steps.map((step) => (
            <li key={step.name} data-step={step.at} className="flex items-center gap-3">
              <StepMark at={step.at} />
              <span
                className={cn(
                  "min-w-0 break-words text-ui",
                  step.at === "now" ? "font-[620] text-foreground" : step.at === "done" ? "text-foreground" : "text-foreground-muted",
                )}
              >
                {step.name}
              </span>
              <span className="sr-only"> ({STEP_WORD[step.at]})</span>
            </li>
          ))}
        </ol>
        <p role="status" className="sr-only">
          {now?.name ?? ""}
        </p>
        {/* Polite: the slow line is read out when it comes. */}
        <div aria-live="polite" className="flex flex-col gap-0.5">
          {slow && running && <p className="text-meta text-foreground-secondary">{S.slow}</p>}
          <p className="text-meta text-foreground-muted">{S.keepOpen}</p>
        </div>
      </div>
      {whose && evidence && evidence.count > 0 && <EvidenceCard whose={whose} count={evidence.count} covers={evidence.covers} />}
    </section>
  );
}
