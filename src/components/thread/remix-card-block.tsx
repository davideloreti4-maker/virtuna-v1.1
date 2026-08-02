'use client';

/**
 * RemixCardRenderer — decode → adapt → FILM (THREAD-04 / D-05).
 *
 * Radical rework (owner 2026-07-22): the card used to stack reference boxes (why the original
 * worked) above a lone adapted line, and told you nothing about executing YOUR version. It is
 * now a decode→adapt MAP — a two-column matrix that maps each element of the original (why it
 * worked, muted-left) to your version (the deliverable, foreground-right) — ending in a
 * ready-to-film shoot plan for the adapted format. The remix's moat (D-05) is now legible as a
 * learn-from-it → make-yours pipeline, not a wall of teardown.
 *
 *  - Flat matte, warm-cream, band color used once (the ProofUnit dot), sage/soft-coral palette.
 *  - Row map: Hook (hookPattern → adaptedHook serif + Copy) · The turn (theTurn → angle) ·
 *    Format (formatBorrowed → your shots). Structure + Emotional beat stay on the expand.
 *  - "How to film your version" foot block (production) mirrors the Script card.
 *  - ONE shared <SimDoor> (2026-08-02: replaces the on-face ProofUnit — a projected card
 *    carries no verdict apparatus; a legacy measured card keeps its "adapted hook" fraction).
 *  - ONE cream primary = the forward chain step "Write hooks for this →"; Save = icon.
 *
 * THREAD-04: the model emits validated RemixCardBlock props only; THIS component owns layout.
 */

import { useContext, useState } from 'react';
import { Copy, Check, VideoCamera } from '@phosphor-icons/react';
import type { RemixCardBlock } from '@/lib/tools/blocks';
import { useOnDevelopRemix } from '@/lib/remix-develop-context';
import { PlatformContext } from '@/lib/platform-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { SimDoor } from './sim-door';
import { CoverFill } from '@/components/primitives/CoverFill';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar, SECTION_LABEL } from './card-primitives';
import { CaretToggle } from './caret-toggle';

export interface RemixCardRendererProps {
  block: RemixCardBlock;
  /** Optional: wired by Plan 06-05 to trigger remix→hooks chain handoff (anchorFrom:'card').
   *  When absent, reads from RemixDevelopContext; falls back to stub if neither present. */
  onDevelop?: () => void;
}

export function RemixCardRenderer({ block, onDevelop: onDevelopProp }: RemixCardRendererProps) {
  const {
    adaptedHook,
    angle,
    whoItsFor,
    formatBorrowed,
    sourceDecode,
    band,
    fraction,
    scrollQuote,
    coverUrl,
    proof,
    production,
    population,
    provenance,
  } = block.props;

  // New Qwen call system (2026-07-22): a "projected" card's adapted-hook band/fraction/quote are the
  // adapt call's generation-time estimate — no persona SIM ran. It must NOT claim a measured
  // reaction: the proof unit reads in the conditional ("would stop") and the provenance tag says
  // "projected", not "SIM-1 Flash". "See the room →" measures it. Absent ⇒ legacy MEASURED (back-compat).
  const projected = provenance === 'projected';

  const onDevelopCtx = useOnDevelopRemix();
  const platform = useContext(PlatformContext) ?? 'tiktok';

  const onDevelop = onDevelopProp ?? (onDevelopCtx
    ? () => onDevelopCtx(adaptedHook, platform)
    : undefined);

  const [expanded, setExpanded] = useState(false);

  // Copy the adapted hook — the remix's deliverable IS a line. Clipboard guarded for happy-dom.
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(adaptedHook).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  }

  return (
    <div
      className="elev-rest @container overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Remix: ${adaptedHook.slice(0, 60)}`}
    >
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Source strip — the post this remix adapts, ATTRIBUTED. A flat one-line row, not the
            boxed compact receipt: the box hugged its content and left the rest of the head band
            empty (the near-empty-strip pattern the owner keeps flagging). The reference reads as
            a quiet attribution line; the map below is the hero. */}
        {proof ? (
          <SourceStrip proof={proof} />
        ) : coverUrl ? (
          <div
            className="flex items-center gap-2.5 self-start"
            aria-label="The original post this remix borrows from"
            title="Remixing this post"
          >
            <span className="relative block aspect-[9/16] w-10 shrink-0 overflow-hidden rounded-sm border border-white/[0.06]">
              <CoverFill coverUrl={coverUrl} playSize={12} />
            </span>
            <span className={SECTION_LABEL}>Remixing this post</span>
          </div>
        ) : null}

        {/* DECODE → ADAPT MAP — the card's hero and its D-05 moat, made legible. Each ROW maps
            one element of the ORIGINAL (why it worked, muted) to YOUR VERSION (the deliverable,
            foreground). Sized by the CARD via container query (@min), never the viewport: a
            342px card can sit in a wide viewport, where an `sm:` grid split it into starved
            columns — and worse, the single-column order interleaved the old column headers so
            "Your version" captioned the original's cell. Pairs now stack together. */}
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          {/* Row 1 — Hook: pattern → your adapted hook (the serif deliverable + Copy) */}
          <MapRow
            leftLabel="Their hook"
            left={<p className="text-body leading-relaxed text-foreground-muted">{sourceDecode.hookPattern}</p>}
            rightLabel="Your hook"
            right={
              <div className="flex items-start justify-between gap-2">
                <p className="font-serif text-subhead font-medium leading-[1.3] tracking-[-0.005em] text-foreground">
                  {adaptedHook}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy adapted hook to clipboard"
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-label font-medium text-foreground-muted transition-colors hover:text-foreground-secondary"
                >
                  {copied ? (
                    <>
                      <Check size={13} weight="bold" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={13} aria-hidden="true" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            }
          />

          {/* Row 2 — The turn: original reversal → your angle */}
          <MapRow
            leftLabel="Their turn"
            left={<p className="text-body leading-relaxed text-foreground-muted">{sourceDecode.theTurn}</p>}
            rightLabel="Your angle"
            right={<p className="text-body leading-relaxed text-foreground-secondary">{angle}</p>}
          />

          {/* Row 3 — Format: borrowed pattern → your shots */}
          <MapRow
            last
            leftLabel="Their format"
            left={<p className="text-body leading-relaxed text-foreground-muted">{formatBorrowed}</p>}
            rightLabel="Your shots"
            right={
              <p className="text-body leading-relaxed text-foreground-secondary">
                {production ? production.shots : `Recreate the ${formatBorrowed.toLowerCase()} for your angle.`}
              </p>
            }
          />
        </div>

        {/* Expand toggle — the rest of the decode anatomy (structure + emotional beat). The
            provenance tag is gone with the on-face verdict: the door states the honest status. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-label text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse decode anatomy' : 'Expand decode anatomy'}
        >
          <CaretToggle open={expanded} />
          Structure & the emotional beat
        </button>

      </div>

      {/* HOW TO FILM YOUR VERSION — the ready-to-film payoff (owner 2026-07-22). Mirrors the
          Script card's production block: the shoot checklist for the adapted format. The map's
          "Your shots" row already leads with the shot list; this carries the rest (on-screen
          text · setup · edit). Absent → nothing (honesty; inert until the runner emits it). */}
      {production && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <VideoCamera size={13} weight="fill" className="shrink-0 text-foreground-secondary opacity-70" aria-hidden="true" />
            <p className={SECTION_LABEL}>How to film your version</p>
          </div>
          <dl className="mt-2 flex flex-col gap-1.5">
            {[
              { term: 'Shots', value: production.shots },
              { term: 'On-screen text', value: production.onScreenText },
              { term: 'Setup', value: production.setup },
              ...(production.edit ? [{ term: 'Edit', value: production.edit }] : []),
            ].map((row) => (
              <div key={row.term} className="flex gap-2 text-label leading-relaxed">
                <dt className="w-[92px] shrink-0 text-foreground-muted">{row.term}</dt>
                <dd className="min-w-0 flex-1 text-foreground-secondary">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* EXPAND — the rest of the decode anatomy (hook pattern + the turn already lead the map). */}
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-white/[0.06] px-4 py-3">
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Structure</p>
            <p className="text-reading leading-relaxed text-foreground-secondary">{sourceDecode.structure}</p>
          </div>
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Emotional beat</p>
            <p className="text-reading leading-relaxed text-foreground-secondary">{sourceDecode.emotionalBeat}</p>
          </div>
        </div>
      )}

      {/* AUDIENCE BAND — who your version lands on (whoItsFor, folded out of its loose caption)
          and the door that measures it. A legacy measured card keeps its real adapted-hook
          fraction (honesty-scoped); a projected card states the aim only. */}
      <SimDoor
        projected={projected}
        aimText={whoItsFor}
        band={band}
        fraction={fraction}
        suffix="adapted hook"
        flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
        conceptText={adaptedHook}
        population={population}
        platform={platform}
        rewrite={buildCardRewrite({
          skill: 'remix',
          fraction,
          scrollQuote,
          conceptText: adaptedHook,
          platform,
          leverRidesAnchor: true,
        })}
        label={projected ? 'Simulate this adapted hook with your audience' : 'See how your audience reacted to this adapted hook'}
      />

      {/* Actions — one cream primary (forward chain "Write hooks for this →") + Save icon. */}
      <CardActionBar>
        <CardPrimaryAction
          onClick={onDevelop}
          disabled={!onDevelop}
          aria-label="Develop this remix concept into hooks"
          title={onDevelop ? 'Develop this remix into hooks' : 'Wired in Plan 06-05'}
        >
          Write hooks for this →
        </CardPrimaryAction>

        {/* A remix IS an adapted hook, but it is not a hook: it carries the decode→adapt matrix
            and its forward step is "write hooks for this", not "write a script". Saving it as
            item_type "hook" (which it did until 2026-08-02, for want of a remix type) made the
            shelf label it "Hook" and offer it the hook action. `remix` is now a real type. */}
        <SaveAffordance className="ml-auto" item_type="remix" title={adaptedHook} snapshot={block.props} />
      </CardActionBar>
    </div>
  );
}

/** One row of the decode→adapt map: the original's element beside (wide card) or above (narrow
 *  card) your version. The split keys on the CARD's width via container query — a media query
 *  cannot see the constraint that matters (a 342px card inside an arbitrary viewport). */
function MapRow({
  leftLabel,
  left,
  rightLabel,
  right,
  last,
}: {
  leftLabel: string;
  left: React.ReactNode;
  rightLabel: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 @min-[480px]:grid-cols-2 ${last ? '' : 'border-b border-white/[0.06]'}`}
    >
      <div className="px-3.5 py-3">
        <p className={`mb-1 ${SECTION_LABEL}`}>{leftLabel}</p>
        {left}
      </div>
      <div className="border-t border-white/[0.06] px-3.5 py-3 @min-[480px]:border-l @min-[480px]:border-t-0">
        <p className={`mb-1 ${SECTION_LABEL}`}>{rightLabel}</p>
        {right}
      </div>
    </div>
  );
}

/** The flat source-attribution strip: cover thumb + "Remixing @handle · views". Links out to the
 *  original when the proof carries a URL; otherwise a plain row. */
function SourceStrip({ proof }: { proof: NonNullable<RemixCardBlock['props']['proof']> }) {
  const views =
    proof.views != null
      ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(proof.views)
      : null;

  const body = (
    <>
      <span className="relative block aspect-[9/16] w-7 shrink-0 overflow-hidden rounded-sm border border-white/[0.06]">
        <CoverFill coverUrl={proof.coverUrl} playSize={10} />
      </span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={SECTION_LABEL}>Remixing</span>
        <span className="text-body font-medium text-foreground-secondary">@{proof.handle}</span>
        {views && <span className="text-label text-foreground-muted">· {views} views</span>}
      </span>
    </>
  );

  const rowClass = 'flex items-center gap-2.5 self-start';

  if (proof.videoUrl) {
    return (
      <a
        href={proof.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${rowClass} transition-opacity hover:opacity-80`}
        title="Open the post you're remixing"
        aria-label={`The post you're remixing: @${proof.handle}`}
      >
        {body}
      </a>
    );
  }
  return (
    <div className={rowClass} aria-label={`The post you're remixing: @${proof.handle}`}>
      {body}
    </div>
  );
}
