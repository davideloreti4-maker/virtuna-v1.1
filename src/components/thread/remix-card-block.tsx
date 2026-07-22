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
 *  - ONE shared <ProofUnit> labelled "adapted hook" (honesty spine — the fraction is the
 *    adapted hook's scroll-stop, NOT the original video's score).
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
import { ProofUnit } from './proof-unit';
import { ProofReceipt } from './proof-receipt';
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
  } = block.props;

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
      className="elev-rest overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Remix: ${adaptedHook.slice(0, 60)}`}
    >
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Source strip — the post this remix adapts, ATTRIBUTED (the same receipt the grounded
            cards use). Compact: it's the reference, not the hero. */}
        {proof ? (
          <ProofReceipt proof={proof} eyebrow="The post you're remixing" compact />
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

        {/* DECODE → ADAPT MAP — the card's hero and its D-05 moat, made legible. A two-column
            matrix: each row maps an element of the ORIGINAL (why it worked, muted-left) to YOUR
            VERSION (the deliverable, foreground-right). Reads as learn-from-it → make-yours.
            Stacks to one column on narrow widths (sm breakpoint). */}
        <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-white/[0.06] sm:grid-cols-2">
          {/* Column headers */}
          <div className="border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
            <p className={SECTION_LABEL}>The original</p>
            <p className="mt-0.5 text-[11px] text-foreground-muted">why it worked</p>
          </div>
          <div className="border-b border-l-0 border-white/[0.06] bg-white/[0.02] px-3.5 py-2 sm:border-l">
            <p className={SECTION_LABEL}>Your version</p>
            <p className="mt-0.5 text-[11px] text-foreground-muted">ready to film</p>
          </div>

          {/* Row 1 — Hook: pattern → your adapted hook (the serif deliverable + Copy) */}
          <MapCell side="left" label="Hook">
            <p className="text-[13px] leading-relaxed text-foreground-muted">{sourceDecode.hookPattern}</p>
          </MapCell>
          <MapCell side="right" label="Your hook">
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif text-[18px] font-medium leading-[1.3] tracking-[-0.005em] text-foreground">
                {adaptedHook}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy adapted hook to clipboard"
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-foreground-muted transition-colors hover:text-foreground-secondary"
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
          </MapCell>

          {/* Row 2 — The turn: original reversal → your angle */}
          <MapCell side="left" label="The turn">
            <p className="text-[13px] leading-relaxed text-foreground-muted">{sourceDecode.theTurn}</p>
          </MapCell>
          <MapCell side="right" label="Your angle">
            <p className="text-[13px] leading-relaxed text-foreground-secondary">{angle}</p>
          </MapCell>

          {/* Row 3 — Format: borrowed pattern → your shots */}
          <MapCell side="left" label="Format" last>
            <p className="text-[13px] leading-relaxed text-foreground-muted">{formatBorrowed}</p>
          </MapCell>
          <MapCell side="right" label="Your shots" last>
            <p className="text-[13px] leading-relaxed text-foreground-secondary">
              {production ? production.shots : `Recreate the ${formatBorrowed.toLowerCase()} for your angle.`}
            </p>
          </MapCell>
        </div>

        {/* Built-for line — who your version lands on (whoItsFor), a quiet caption under the map. */}
        <p className="text-[12px] text-foreground-muted">
          Built for <span className="text-foreground-secondary">{whoItsFor}</span>
        </p>

        {/* Proof unit — the quiet room through-line, adapted-hook scroll-stop (honesty-scoped). */}
        <ProofUnit
          framed={false}
          band={band}
          fraction={fraction}
          quote={scrollQuote}
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
          label="See how the room reacted to this adapted hook"
        />

        {/* Expand toggle — the rest of the decode anatomy (structure + emotional beat) + provenance. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse decode anatomy' : 'Expand decode anatomy'}
        >
          <CaretToggle open={expanded} />
          Structure & the emotional beat
          <span className="text-foreground-muted/70">· SIM-1 Flash</span>
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
              <div key={row.term} className="flex gap-2 text-[12.5px] leading-relaxed">
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
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.structure}</p>
          </div>
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Emotional beat</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.emotionalBeat}</p>
          </div>
        </div>
      )}

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

        {/* A remix output is an adapted hook; save it as item_type "hook". */}
        <SaveAffordance className="ml-auto" item_type="hook" title={adaptedHook} snapshot={block.props} />
      </CardActionBar>
    </div>
  );
}

/** One cell of the decode→adapt matrix. Right cells get the vertical divider (sm+) and both
 *  sides get the row separator, so the grid reads as an aligned map of original ↔ yours. */
function MapCell({
  side,
  label,
  last,
  children,
}: {
  side: 'left' | 'right';
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'px-3.5 py-3',
        side === 'right' ? 'border-white/[0.06] sm:border-l' : 'border-white/[0.06]',
        last ? '' : 'border-b',
      ].join(' ')}
    >
      <p className={`mb-1 ${SECTION_LABEL}`}>{label}</p>
      {children}
    </div>
  );
}
