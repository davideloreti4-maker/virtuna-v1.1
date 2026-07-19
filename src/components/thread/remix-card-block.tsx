'use client';

/**
 * RemixCardRenderer — decode-anatomy-forward remix card (THREAD-04 / D-05).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte, warm-cream, band color used once, ZERO coral.
 *  - Eyebrow = "Borrowed · {format}" chip + the audience-steer tag ("as your {audience}").
 *  - Two-column Angle / For; the adapted hook is the hero.
 *  - ONE shared <ProofUnit> labelled "adapted hook" (honesty spine — the fraction is the
 *    adapted hook's scroll-stop, NOT the original video's score).
 *  - Decode anatomy (the D-05 moat: WHY the original worked) on expand.
 *  - ONE cream primary = the forward chain step "Develop into hooks →" (§1.7); Save = icon.
 *
 * THREAD-04: the model emits validated RemixCardBlock props only; THIS component owns layout.
 */

import { useContext, useState } from 'react';
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
    audienceName,
    coverUrl,
    proof,
    population,
  } = block.props;

  // Read RemixDevelopContext — enables RemixThreadView to provide the handler without
  // prop-drilling through MessageBlocks (mirrors ScriptCardRenderer + ScriptTestContext).
  const onDevelopCtx = useOnDevelopRemix();

  // Read PlatformContext so the card can include the correct platform in the anchor POST.
  const platform = useContext(PlatformContext) ?? 'tiktok';

  const onDevelop = onDevelopProp ?? (onDevelopCtx
    ? () => onDevelopCtx(adaptedHook, platform)
    : undefined);

  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Remix: ${adaptedHook.slice(0, 60)}`}
    >
      {/* FACE — adapted hook anatomy (always visible). */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Source receipt — the post this remix adapts, ATTRIBUTED. Remix is the most
            source-derived card we ship, and it used to show that source as an anonymous
            thumbnail: you could see the video but never learn whose it was, how it did, or how
            to open it. It now renders the same <ProofReceipt> as the grounded cards.

            The eyebrow differs on purpose. "Proven structure" is a claim retrieval earns by
            checking a video against a follower baseline; nobody checked this one — you pasted
            it. So the receipt says what it is, and the null multiplier/fit mean the card shows
            the creator and the reach and stops there (see RemixCardBlockSchema.proof).

            Falls back to the legacy bare cover for blocks stored before `proof` existed. */}
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

        {/* Eyebrow — "Borrowed · {format}" chip + audience-steer tag (no coral). */}
        <div className="flex items-center justify-between gap-3">
          <span
            className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[12px] text-foreground-secondary"
            title="The format pattern borrowed from the decoded video"
            aria-label={`Format borrowed: ${formatBorrowed}`}
          >
            Borrowed · {formatBorrowed}
          </span>
          {audienceName ? (
            <span
              className="shrink-0 text-[12px] text-foreground-muted"
              aria-label={`Adapted for your ${audienceName} audience`}
              title={`Generated for your "${audienceName}" audience`}
            >
              as your {audienceName}
            </span>
          ) : null}
        </div>

        {/* Adapted hook headline — the hero. */}
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{adaptedHook}</p>

        {/* Angle / For — two quiet columns. */}
        <div className="flex gap-6">
          <div className="min-w-0">
            <p className={`mb-0.5 ${SECTION_LABEL}`}>Angle</p>
            <p className="text-[13px] leading-snug text-foreground-secondary">{angle}</p>
          </div>
          <div className="min-w-0">
            <p className={`mb-0.5 ${SECTION_LABEL}`}>For</p>
            <p className="text-[13px] leading-snug text-foreground-secondary">{whoItsFor}</p>
          </div>
        </div>

        {/* Proof unit — adapted-hook scroll-stop (honesty-scoped). */}
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
            // remix self-handoff → /api/tools/ideas/develop (anchor-only); lever rides anchor.
            leverRidesAnchor: true,
          })}
          label="See how the room reacted to this adapted hook"
        />

        {/* Expand toggle — the decode anatomy (why the original worked) + provenance. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse decode anatomy' : 'Expand decode anatomy'}
        >
          <CaretToggle open={expanded} />
          Why the original worked
          <span className="text-foreground-muted/70">· SIM-1 Flash</span>
        </button>
      </div>

      {/* EXPAND — the real decode anatomy (D-05 moat). */}
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-white/[0.06] px-4 py-3">
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Hook pattern</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.hookPattern}</p>
          </div>
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Structure</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.structure}</p>
          </div>
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>The turn</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.theTurn}</p>
          </div>
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Emotional beat</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.emotionalBeat}</p>
          </div>
        </div>
      )}

      {/* Actions — one cream primary (forward chain "Develop into hooks →") + Save icon (§0.5.7). */}
      <CardActionBar>
        <CardPrimaryAction
          onClick={onDevelop}
          disabled={!onDevelop}
          aria-label="Develop this remix concept into hooks"
          title={onDevelop ? 'Develop this remix into hooks' : 'Wired in Plan 06-05'}
        >
          Develop into hooks →
        </CardPrimaryAction>

        {/* A remix output is an adapted hook; save it as item_type "hook". */}
        <SaveAffordance className="ml-auto" item_type="hook" title={adaptedHook} snapshot={block.props} />
      </CardActionBar>
    </div>
  );
}
