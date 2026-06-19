'use client';

/**
 * IdeaCardRenderer — concept-forward idea card (D-08/D-09/D-10/D-11).
 *
 * Design constraints (THREAD-04 / D-10):
 *  - The model emits validated IdeaCardBlock props only; THIS component owns layout.
 *  - No model-generated markup, no dynamic component selection.
 *
 * Card anatomy:
 *  FACE (always visible, D-08):
 *    title · angle · whyItFits (grounding line, D-09) · scrollQuote (lead quote, D-04)
 *  EXPAND (tap/disclosure, D-08):
 *    mechanism · seedHook · Topic×Take×Format breakdown
 *  BADGE (D-11): "needs your first-hand take" when needsTake is true
 *  SECONDARY CHIP (D-04): band + fraction + SIM-1 Flash tag
 *  CTA (D-15/THREAD-05/IDEAS-03): "Develop this →" — chains to Hooks via /develop endpoint
 *
 * Zone color tokens reused from band-block.tsx (CSS variables).
 * THEME-06 flat-warm Raycast design: 6% borders, 12px card radius, Inter.
 * Coral accent only on the CTA / "needs take" badge, not the band chip.
 *
 * "Develop this →" (D-15):
 *  Calls POST /api/tools/ideas/develop with { anchor: title+angle, platform }.
 *  The platform is read from PlatformContext (set by IdeasThreadView).
 *  Appends a Hooks placeholder message in the SAME open thread (the in-thread
 *  chain seam). Hooks GENERATION is deferred to Plan 04 (P4).
 */

import { useCallback, useState } from 'react';
import type { IdeaCardBlock } from '@/lib/tools/blocks';
import { usePlatform } from '@/lib/platform-context';
import { LensTrigger } from '@/components/audience-lens/LensTrigger';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';

export interface IdeaCardRendererProps {
  block: IdeaCardBlock;
}

const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-success)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-error)',
};

export function IdeaCardRenderer({ block }: IdeaCardRendererProps) {
  const {
    title,
    angle,
    whyItFits,
    mechanism,
    seedHook,
    needsTake,
    topic,
    take,
    format,
    band,
    fraction,
    scrollQuote,
  } = block.props;

  const platform = usePlatform();
  const [expanded, setExpanded] = useState(false);
  const bandColor = BAND_COLOR[band];

  // ── "Develop this →" CTA state ────────────────────────────────────────────
  const [developing, setDeveloping] = useState(false);
  const [developError, setDevelopError] = useState<string | null>(null);
  const [developed, setDeveloped] = useState(false);

  /**
   * Call the PINNED /develop endpoint (D-15/THREAD-05/IDEAS-03).
   * Sends the chosen idea as the assembler anchor + appends a Hooks placeholder
   * in the open thread. Hooks GENERATION is P4.
   */
  const handleDevelop = useCallback(async () => {
    if (developing || developed) return;
    setDeveloping(true);
    setDevelopError(null);

    try {
      // anchor = the concept text that describes this idea (title + angle)
      const anchor = `${title}\n\n${angle}`;
      const res = await fetch('/api/tools/ideas/develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anchor,
          platform,
          // No ideaId in v1 — idea cards are not individually persisted by id
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Develop request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Develop request failed');
      }
      // Success: the Hooks placeholder has been appended to the open thread.
      setDeveloped(true);
    } catch (err) {
      setDevelopError(err instanceof Error ? err.message : 'Develop error');
    } finally {
      setDeveloping(false);
    }
  }, [developing, developed, title, angle, platform]);

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0 1px 0 0 inset' }}
      aria-label={`Idea: ${title}`}
    >
      {/* FACE — always visible */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">

        {/* Title row + optional "needs take" badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground leading-snug">
            {title}
          </h3>
          {needsTake && (
            <span
              className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{
                color: '#FF7F50',
                borderColor: 'rgba(255,127,80,0.3)',
                backgroundColor: 'rgba(255,127,80,0.08)',
              }}
              title="This idea leans on a perspective only you can supply"
            >
              your take
            </span>
          )}
        </div>

        {/* Angle — the framing premise */}
        <p className="text-sm text-muted leading-snug">{angle}</p>

        {/* Grounding line — visually distinct from angle prose (D-09) */}
        <div
          className="rounded-lg px-3 py-2 border border-white/[0.06] bg-white/[0.02] text-xs text-muted/80 leading-snug"
          aria-label="Why this fits your profile"
        >
          {whyItFits}
        </div>

        {/* Lead scroll-quote — the primary SIM signal (D-04). Tapping it opens the single
            reusable AudienceLens inline (cascade mode, D-06/D-04). */}
        <LensTrigger
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={`${title}\n\n${angle}`}
          platform={platform}
          label="See how the room reacted to this idea"
        >
          <blockquote
            className="border-l-2 border-white/[0.12] pl-3 text-sm text-foreground/80 italic leading-snug"
            aria-label="Audience scroll quote"
          >
            &ldquo;{scrollQuote}&rdquo;
          </blockquote>
        </LensTrigger>

        {/* Secondary band chip + expand toggle row */}
        <div className="flex items-center justify-between gap-2">

          {/* Band chip — secondary signal (D-04) */}
          <div
            className="flex items-center gap-2 text-xs"
            aria-label={`${band} pull — ${fraction} — SIM-1 Flash`}
          >
            <span
              className="font-medium"
              style={{ color: bandColor }}
            >
              {band}
            </span>
            <span className="text-muted/60">·</span>
            <span style={{ color: bandColor, opacity: 0.75 }}>{fraction}</span>
            <span className="text-muted/40">·</span>
            <span className="text-muted/50">SIM-1 Flash</span>
          </div>

          {/* Expand / collapse toggle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted/60 hover:text-muted transition-colors"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse idea details' : 'Expand idea details'}
          >
            {expanded ? '↑ Less' : '↓ Details'}
          </button>
        </div>
      </div>

      {/* EXPAND — tap to reveal mechanism, seedHook, Topic×Take×Format */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-3">

          {/* Mechanism */}
          <div>
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Mechanism</p>
            <p className="text-sm text-foreground/90 leading-snug">{mechanism}</p>
          </div>

          {/* Seed hook */}
          <div>
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Seed hook</p>
            <p className="text-sm text-foreground/80 leading-snug">{seedHook}</p>
          </div>

          {/* Topic × Take × Format breakdown */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              <div className="px-3 py-2">
                <span className="text-xs text-muted/60 uppercase tracking-wide">Topic</span>
                <p className="text-sm text-foreground/90 mt-0.5 leading-snug">{topic}</p>
              </div>
              <div className="px-3 py-2">
                <span className="text-xs text-muted/60 uppercase tracking-wide">Take</span>
                <p className="text-sm text-foreground/90 mt-0.5 leading-snug">{take}</p>
              </div>
              {format && (
                <div className="px-3 py-2">
                  <span className="text-xs text-muted/60 uppercase tracking-wide">Format</span>
                  <p className="text-sm text-foreground/90 mt-0.5 leading-snug">{format}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* "Develop this →" CTA (D-15/THREAD-05/IDEAS-03) ────────────────────── */}
      {/* Calls PINNED /api/tools/ideas/develop to write anchor + Hooks placeholder */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        {!developed ? (
          <>
            <button
              type="button"
              onClick={() => void handleDevelop()}
              disabled={developing}
              className="text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              style={{
                color: developing ? 'rgba(255,127,80,0.5)' : '#FF7F50',
                cursor: developing ? 'wait' : 'pointer',
              }}
              aria-label="Develop this idea into hooks"
            >
              {developing ? 'Developing…' : 'Develop this →'}
            </button>
            {developError && (
              <p className="mt-1 text-xs text-red-400" role="alert">
                {developError}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-foreground-muted/60">
            Hooks queued — check the thread below.
          </p>
        )}
      </div>
    </div>
  );
}
