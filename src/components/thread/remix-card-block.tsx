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
import { SaveAffordance } from '@/components/thread/save-affordance';

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
        {/* Source thumbnail — the real cover of the post being remixed (display-only).
            Additive: renders ONLY when coverUrl is present; a broken/expired CDN URL hides
            the <img> (the placeholder bg shows), never a broken-image icon. */}
        {coverUrl ? (
          <div
            className="flex items-center gap-2.5 self-start"
            aria-label="The original post this remix borrows from"
            title="Remixing this post"
          >
            <span className="relative block aspect-[9/16] w-10 shrink-0 overflow-hidden rounded-[5px] border border-white/[0.06] bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN cover, not a static asset */}
              <img
                src={coverUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </span>
            <span className="text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Remixing this post</span>
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
            <p className="mb-0.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Angle</p>
            <p className="text-[13px] leading-snug text-foreground-secondary">{angle}</p>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">For</p>
            <p className="text-[13px] leading-snug text-foreground-secondary">{whoItsFor}</p>
          </div>
        </div>

        {/* Proof unit — adapted-hook scroll-stop (honesty-scoped). */}
        <ProofUnit
          band={band}
          fraction={fraction}
          quote={scrollQuote}
          suffix="adapted hook"
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={adaptedHook}
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
          <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
          Why the original worked
          <span className="text-foreground-muted/70">· SIM-1 Flash</span>
        </button>
      </div>

      {/* EXPAND — the real decode anatomy (D-05 moat). */}
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-white/[0.06] px-4 py-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Hook pattern</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.hookPattern}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Structure</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.structure}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">The turn</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.theTurn}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Emotional beat</p>
            <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{sourceDecode.emotionalBeat}</p>
          </div>
        </div>
      )}

      {/* Actions — one cream primary (forward chain "Develop into hooks →") + Save icon. */}
      <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={onDevelop}
          disabled={!onDevelop}
          className="rounded-[8px] bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-default disabled:opacity-40"
          aria-label="Develop this remix concept into hooks"
          title={onDevelop ? 'Develop this remix into hooks' : 'Wired in Plan 06-05'}
        >
          Develop into hooks →
        </button>

        {/* A remix output is an adapted hook; save it as item_type "hook". */}
        <SaveAffordance className="ml-auto" item_type="hook" title={adaptedHook} snapshot={block.props} />
      </div>
    </div>
  );
}
