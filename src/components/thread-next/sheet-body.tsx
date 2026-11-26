"use client";

import Link from "next/link";
import { useId } from "react";

import { creditCost } from "@/lib/pricing";
import type { HookCardBlock, HookProof, IdeaCardBlock } from "@/lib/tools/blocks";
import { foldLead } from "@/lib/thread-next/first-sentence";
import { usableWhy } from "@/lib/thread-next/pick-line";
import { cn } from "@/lib/utils";

import { AnswerPrimary, PROSE, creditsLabel, keepHyphens } from "./answer-card";
import { EmptyArt, SmallGauge, clipName, stopWords, type GaugeState } from "./answer-gauge";
import { ExternalIcon } from "./answer-icons";
import { ChevronIcon, DocIcon } from "./field-icons";
import { MoreButton, useFold } from "./fold-more";
import { ProofCover, proofStats } from "./remix-answer";

/**
 * The details sheet's bodies (thread answers step 2, spec §3; drawing P6, `.ax-shg`, `.ax-shl`, `.ax-sec`,
 * `.ax-src`, `.ax-shb`). Under the sheet's large text (the shell's heading):
 *
 * - The gauge row: the 52 gauge, then — simulated: "would stop to watch ›", a link to the result page
 *   (once its key is known; until then the words alone); not simulated: "Simulate" · "1 credit" (the
 *   thread's queue); waiting or running: "Simulating"; failed: "Couldn't simulate" and Simulate. Copy and
 *   Save at the right (`actions`).
 * - A hook: "Proven" (the proof row; a link to its video in a new tab when it has one), "Visual"
 *   (`onScreen`), "Why it works": the writer's plain reason whole when it has a usable one (`usableWhy`,
 *   Maven's pick), else its `mechanism`'s lead (`foldLead`: the first sentence, or the words that fit
 *   about two lines; "More" opens the rest in place).
 * - An idea: "The take" (whole), "Why it fits" (folded), "Format".
 * - The one primary "Script this one" · "2 credits".
 *
 * Never: fraction, band, scroll quote, target, rank, seed line, channel.
 */

export interface SheetGauge {
  state: GaugeState;
  /** Its last simulation failed and it has no number. */
  failed: boolean;
  /** The text it simulates: names its controls. */
  text: string;
  /** The result page, once simulated and its key is known; null: no link (yet). */
  href: string | null;
  onSimulate?: () => void;
}

const LABEL = "flex items-center gap-3 text-reading text-foreground-secondary";

function SheetGaugeControl({ gauge }: { gauge: SheetGauge }) {
  const priceId = useId();
  const failedId = useId();
  const numberId = useId();
  const { state, failed, text, href, onSimulate } = gauge;

  if (state.kind === "done") {
    const body = (
      <>
        <SmallGauge state={state} size={52} label={text} />
        <span>would stop to watch</span>
        {href && <ChevronIcon size={14} strokeWidth={2.1} aria-hidden className="-ml-1 shrink-0 text-foreground-muted" />}
      </>
    );
    // The name replaces the content, so the number is read as the link's description.
    return href ? (
      <Link
        href={href}
        aria-label={`Open the result: ${clipName(text)}`}
        aria-describedby={numberId}
        data-sheet="result-link"
        className={cn(LABEL, "rounded-xl")}
      >
        {body}
        <span id={numberId} className="sr-only">
          {stopWords(state.value)}
        </span>
      </Link>
    ) : (
      <div className={LABEL}>{body}</div>
    );
  }

  if (state.kind === "running" || state.kind === "waiting") {
    return (
      <div className={LABEL}>
        <SmallGauge state={state} size={52} label={text} />
        <span>Simulating</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Simulate: ${clipName(text)}`}
      // The name replaces the content, so a failure is read as the description, beside the price.
      aria-describedby={failed ? `${priceId} ${failedId}` : priceId}
      disabled={!onSimulate}
      onClick={onSimulate}
      // The same outlined button as a card's Simulate slot, at the sheet's gauge size: beside Copy and
      // Save (filled circles) a bare ring and two words looked like the least tappable thing there.
      className="group flex cursor-pointer items-center gap-3 rounded-lg pr-5 text-left inset-ring inset-ring-foreground/16 transition-colors duration-150 hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span
        aria-hidden
        className="relative block size-[52px] shrink-0 text-foreground-muted transition-colors duration-150 group-hover:text-foreground group-disabled:text-foreground-muted"
      >
        <EmptyArt size={52} />
      </span>
      <span className="flex flex-col">
        <span className="text-reading font-[570] text-foreground">
          Simulate{" "}
          <em id={priceId} className="font-medium not-italic text-foreground-muted">
            {creditsLabel(creditCost("react"))}
          </em>
        </span>
        {failed && (
          <span id={failedId} className="text-meta text-foreground-secondary">
            Couldn&apos;t simulate
          </span>
        )}
      </span>
    </button>
  );
}

function SheetGaugeRow({ gauge, actions }: { gauge: SheetGauge; actions: React.ReactNode }) {
  return (
    <div data-sheet="gauge-row" className="mt-3 flex items-center gap-2 px-0.5 pb-3.5 pt-0.5">
      <SheetGaugeControl gauge={gauge} />
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

/** The first sentence, and "More" that opens the rest in place (focus moves to the whole text; `useFold`). */
function FoldedText({ text }: { text: string }) {
  const { open, openFold, wholeRef } = useFold();
  const whole = text.trim();
  const lead = foldLead(whole);
  if (open || lead === null) {
    return (
      <span tabIndex={open ? -1 : undefined} ref={wholeRef}>
        {keepHyphens(whole)}
      </span>
    );
  }
  return (
    <>
      {keepHyphens(lead)} <MoreButton onOpen={openFold} />
    </>
  );
}

function SheetSection({ label, plain = false, children }: { label: string; plain?: boolean; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-0.5 py-3">
      <h3 className="text-meta font-[620] text-foreground-secondary">{label}</h3>
      {plain ? children : <p className={cn("mt-[3px] text-pretty text-ui leading-[21px] text-foreground", PROSE)}>{children}</p>}
    </section>
  );
}

function ProofRow({ proof }: { proof: HookProof }) {
  const handle = proof.handle.trim().replace(/^@+/, "");
  const stats = proofStats(proof);
  const body = (
    <>
      <ProofCover src={proof.coverUrl} />
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-reading font-[620] leading-[21px] text-foreground">@{handle}</span>
        {stats && <span className="block text-meta leading-[21px] text-foreground-secondary tabular-nums">{stats}</span>}
      </span>
      {proof.videoUrl && <ExternalIcon size={16} aria-hidden className="shrink-0 text-foreground-muted" />}
    </>
  );
  const box = "mt-2 flex items-center gap-[11px] rounded-xl bg-foreground/5 py-2 pl-2 pr-3.5";
  return proof.videoUrl ? (
    <a
      href={proof.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-sheet="proof"
      aria-label={`Proven: @${handle}${stats ? `, ${stats}` : ""}. Opens the video`}
      className={box}
    >
      {body}
    </a>
  ) : (
    <div data-sheet="proof" className={box}>
      {body}
    </div>
  );
}

function SheetPrimary({ onScript }: { onScript?: () => void }) {
  return (
    <div className="mt-2">
      <AnswerPrimary
        icon={<DocIcon size={20} aria-hidden className="shrink-0" />}
        label="Script this one"
        price={creditCost("script")}
        onClick={onScript}
      />
    </div>
  );
}

export function HookSheetBody({
  hook,
  gauge,
  actions,
  onScript,
}: {
  hook: HookCardBlock["props"];
  gauge: SheetGauge;
  actions: React.ReactNode;
  onScript?: () => void;
}) {
  const mechanism = hook.mechanism.trim();
  // Maven's pick (spec 2026-11-25-maven-pick-design.md §3.2): the writer's plain reason, short by rule,
  // so it is shown whole; a pack written before it has none and keeps its folded mechanism.
  const why = usableWhy(hook.why, hook.hookLine);
  const visual = hook.visualHook?.onScreen?.trim();
  return (
    <>
      <SheetGaugeRow gauge={gauge} actions={actions} />
      {/* Trust, then use, then theory (review 2026-11-23, on real hooks): the proof is a real video
          with its numbers; the visual says what to shoot; "why it works" comes last: the writer's
          plain reason, whole, or for an older pack its own long reasoning, folded. Drawn: why,
          visual, proven. */}
      {hook.proof && (
        <SheetSection label="Proven" plain>
          <ProofRow proof={hook.proof} />
        </SheetSection>
      )}
      {visual && <SheetSection label="Visual">{keepHyphens(visual)}</SheetSection>}
      {(why || mechanism) && (
        <SheetSection label="Why it works">{why ? keepHyphens(why) : <FoldedText text={mechanism} />}</SheetSection>
      )}
      <SheetPrimary onScript={onScript} />
    </>
  );
}

/**
 * The ideas runner's grounding line (`buildGroundingLine`, `src/lib/kc/grounding-line.ts`), in both of
 * its forms: "Because: …" and a list of audience tags, or "Based on TikTok baselines — add your
 * profile for tailored ideas" when the profile is thin.
 */
const GROUNDING_LINE = /^(because\s*:|based on .+ baselines\b)/i;

export function IdeaSheetBody({
  idea,
  gauge,
  actions,
  onScript,
}: {
  idea: IdeaCardBlock["props"];
  gauge: SheetGauge;
  actions: React.ReactNode;
  onScript?: () => void;
}) {
  const take = idea.take.trim();
  // Today's ideas runner stores its audience grounding line here ("Because: your tiktok audience —
  // warm-leaning · connector · skeptic · scanner"): the same tag list on every idea of a pack, the
  // engine's words, not a reason a creator can read (seen on a real thread, 2026-11-23). Not shown.
  // A sentence (the fixtures', a later runner's) is.
  const stored = idea.whyItFits.trim();
  const why = GROUNDING_LINE.test(stored) ? "" : stored;
  const format = idea.format?.trim();
  return (
    <>
      <SheetGaugeRow gauge={gauge} actions={actions} />
      {take && <SheetSection label="The take">{keepHyphens(take)}</SheetSection>}
      {why && (
        <SheetSection label="Why it fits">
          <FoldedText text={why} />
        </SheetSection>
      )}
      {format && <SheetSection label="Format">{keepHyphens(format)}</SheetSection>}
      <SheetPrimary onScript={onScript} />
    </>
  );
}
