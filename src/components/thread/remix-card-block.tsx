'use client';

/**
 * RemixCardRenderer — decode-anatomy-forward remix card (THREAD-04 / D-05).
 *
 * Design constraints (THREAD-04):
 *  - The model emits validated RemixCardBlock props only; THIS component owns layout.
 *  - No model-generated markup, no dynamic component selection.
 *
 * Card anatomy:
 *  FACE (always visible):
 *    adaptedHook headline (dominant) · "Borrowed:" format chip · angle/whoItsFor sub-rows
 *  EXPAND (tap/disclosure, D-08):
 *    sourceDecode — the REAL structural decode anatomy (WHY the original worked, D-05 moat):
 *      hookPattern · structure · theTurn · emotionalBeat
 *  SECONDARY CHIP (Pitfall 5 honesty spine — ADAPTED HOOK ONLY):
 *    band + fraction + "adapted hook scroll-stop" copy + SIM-1 Flash tag
 *    This signal describes the adapted hook's scroll-stop only — NOT the original video's score.
 *  CTA (remix→hooks affordance): "Develop into hooks →" — the seam for Plan 06-05 to wire the
 *    chain-handoff (anchorFrom:'card'). Stub when context absent (mirrors HookCardRenderer plan-01).
 *
 * D-05 moat: sourceDecode surfaces the structural reason the original video worked.
 *   hookPattern / structure / theTurn / emotionalBeat are real decode engine outputs —
 *   NOT a metadata guess. This is the differentiated insight the creator cannot get from a
 *   generic description.
 *
 * THEME-06 flat-warm Raycast design: 6% borders, 12px card radius, Inter.
 * Coral accent on "Borrowed:" chip + "Develop into hooks →" CTA only.
 */

import { useState, useContext } from 'react';
import type { RemixCardBlock } from '@/lib/tools/blocks';
import { useOnDevelopRemix } from '@/lib/remix-develop-context';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { PlatformContext } from '@/lib/platform-context';
import { LensTrigger } from '@/components/audience-lens/LensTrigger';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';

export interface RemixCardRendererProps {
  block: RemixCardBlock;
  /** Optional: wired by Plan 06-05 to trigger remix→hooks chain handoff (anchorFrom:'card').
   *  When absent, reads from RemixDevelopContext; falls back to stub if neither present. */
  onDevelop?: () => void;
}

const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-success)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-error)',
};

/** Muted sub-row label style — consistent with script-card beat label */
const SUB_LABEL_STYLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.40)',
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
};

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
  } = block.props;

  // Read RemixDevelopContext — enables RemixThreadView to provide the handler without
  // prop-drilling through MessageBlocks (mirrors ScriptCardRenderer + ScriptTestContext).
  const onDevelopCtx = useOnDevelopRemix();

  // Read PlatformContext so the card can include the correct platform in the anchor POST.
  const platform = useContext(PlatformContext) ?? 'tiktok';

  // Resolve: explicit prop > context (bound with card's adaptedHook + live platform) > null (stub)
  const onDevelop = onDevelopProp ?? (onDevelopCtx
    ? () => {
        // The card POSTs the adaptedHook as the anchor to the develop endpoint.
        // Platform comes from PlatformContext set by RemixThreadView.
        onDevelopCtx(adaptedHook, platform);
      }
    : undefined);

  const [expanded, setExpanded] = useState(false);
  const bandColor = BAND_COLOR[band];

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0 1px 0 0 inset' }}
      aria-label={`Remix: ${adaptedHook.slice(0, 60)}`}
    >
      {/* FACE — adapted hook anatomy (always visible) */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">

        {/* "Borrowed:" format chip — coral accent (the format seam) */}
        <div className="flex items-start gap-2">
          <span
            className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{
              color: '#FF7F50',
              borderColor: 'rgba(255,127,80,0.3)',
              backgroundColor: 'rgba(255,127,80,0.08)',
            }}
            title="The format pattern borrowed from the decoded video"
            aria-label={`Format borrowed: ${formatBorrowed}`}
          >
            Borrowed: {formatBorrowed}
          </span>
        </div>

        {/* 08-04 / D-03 STEER tag — "as your {audience}" near the adapted-hook headline.
            Muted/foreground only, NEVER coral (coral stays on Borrowed chip + Develop CTA —
            one-coral law). Rendered only for a calibrated audience; General → no tag, byte-
            identical to today (regression-safe no-op). */}
        {audienceName ? (
          <span
            className="text-xs text-muted/60"
            style={{ letterSpacing: '0.02em' }}
            aria-label={`Adapted for your ${audienceName} audience`}
            title={`Generated for your "${audienceName}" audience`}
          >
            as your {audienceName}
          </span>
        ) : null}

        {/* Adapted hook headline — dominant face element (AdaptConcept.hook) */}
        <p className="text-base font-semibold text-foreground leading-snug">
          {adaptedHook}
        </p>

        {/* Angle + who it is for — muted sub-rows (AdaptConcept.angle / .who_its_for) */}
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <span style={SUB_LABEL_STYLE} className="shrink-0 mt-0.5">Angle</span>
            <p className="text-sm text-foreground/70 leading-snug">{angle}</p>
          </div>
          <div className="flex items-start gap-2">
            <span style={SUB_LABEL_STYLE} className="shrink-0 mt-0.5">For</span>
            <p className="text-sm text-foreground/70 leading-snug">{whoItsFor}</p>
          </div>
        </div>

        {/* Lead scroll-quote — the primary SIM signal for the adapted hook. Tapping it opens
            the single reusable AudienceLens inline (cascade mode, D-06/D-04). */}
        <LensTrigger
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
        >
          <blockquote
            className="border-l-2 border-white/[0.12] pl-3 text-sm text-foreground/80 italic leading-snug"
            aria-label="Audience scroll quote for adapted hook"
          >
            &ldquo;{scrollQuote}&rdquo;
          </blockquote>
        </LensTrigger>

        {/* Opener-scoped band chip + expand toggle row */}
        <div className="flex items-center justify-between gap-2">
          {/* Band chip — adapted hook scroll-stop ONLY (Pitfall 5 honesty spine) */}
          <div
            className="flex items-center gap-2 text-xs"
            aria-label={`${band} adapted hook pull — ${fraction} — SIM-1 Flash`}
            title="Adapted-hook signal — describes scroll-stop for the adapted hook only, not the original video score"
          >
            <span className="font-medium" style={{ color: bandColor }}>
              {band}
            </span>
            <span className="text-muted/60">·</span>
            <span style={{ color: bandColor, opacity: 0.75 }}>{fraction}</span>
            <span className="text-muted/40">·</span>
            <span className="text-muted/50">adapted hook scroll-stop</span>
            <span className="text-muted/40">·</span>
            <span className="text-muted/50">SIM-1 Flash</span>
          </div>

          {/* Expand / collapse toggle for decode anatomy */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted/60 hover:text-muted transition-colors"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse decode anatomy' : 'Expand decode anatomy'}
          >
            {expanded ? '↑ Why it worked' : '↓ Why it worked'}
          </button>
        </div>
      </div>

      {/* EXPAND — the real decode anatomy (D-05 moat: WHY the original worked) */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-4">
          <p
            className="text-xs text-muted/50 uppercase tracking-wide"
            style={{ letterSpacing: '0.07em' }}
          >
            Original decode anatomy
          </p>

          {/* Hook pattern beat */}
          <div>
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Hook pattern</p>
            <p className="text-sm text-foreground/80 leading-snug">{sourceDecode.hookPattern}</p>
          </div>

          {/* Structure / pacing beat */}
          <div>
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Structure</p>
            <p className="text-sm text-foreground/80 leading-snug">{sourceDecode.structure}</p>
          </div>

          {/* The turn beat */}
          <div>
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">The turn</p>
            <p className="text-sm text-foreground/80 leading-snug">{sourceDecode.theTurn}</p>
          </div>

          {/* Emotional beat */}
          <div>
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Emotional beat</p>
            <p className="text-sm text-foreground/80 leading-snug">{sourceDecode.emotionalBeat}</p>
          </div>
        </div>
      )}

      {/* CTA — "Develop into hooks →" (remix→hooks, anchorFrom:'card' — wired in 06-05) */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-4">
        {/* Save (Act→State) — a remix output is an adapted hook; save it as item_type "hook". */}
        <SaveAffordance item_type="hook" title={adaptedHook} snapshot={block.props} />

        <button
          type="button"
          onClick={onDevelop}
          disabled={!onDevelop}
          className="text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          style={{
            color: onDevelop ? '#FF7F50' : 'rgba(255,127,80,0.35)',
            cursor: onDevelop ? 'pointer' : 'default',
          }}
          aria-label="Develop this remix concept into hooks"
          title={onDevelop ? 'Develop this remix into hooks' : 'Wired in Plan 06-05'}
        >
          Develop into hooks →
        </button>
      </div>
    </div>
  );
}
