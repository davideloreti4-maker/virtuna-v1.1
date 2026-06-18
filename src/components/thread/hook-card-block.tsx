'use client';

/**
 * HookCardRenderer — hook-line-forward hook card (D-05/D-08/D-11).
 *
 * Design constraints (THREAD-04 / D-11):
 *  - The model emits validated HookCardBlock props only; THIS component owns layout.
 *  - No model-generated markup, no dynamic component selection.
 *
 * Card anatomy:
 *  FACE (always visible, D-11):
 *    hookLine (dominant) · audienceArchetype tag chip (D-03) · scrollQuote (lead, D-02/D-04) · rank badge
 *  EXPAND (tap/disclosure, D-08):
 *    mechanism (prose — private craft reasoning surfaced, NOT a slug) · seedHook · channel (if present)
 *  SECONDARY CHIP (D-04): band + fraction + SIM-1 Flash tag
 *  CTA (D-05): "Test full →" — the seam for Plan 03 to wire the deep-link handoff.
 *    Exposes onTest?: () => void prop. Stubbed handler here (Plan 03 wires the real deep-link).
 *
 * D-04: audienceArchetype is the AUDIENCE persona tag (D-03), never a craft slug.
 *   mechanism is prose reasoning. channel is a multi-modal hint, not a craft form.
 *   No BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE/QUESTION in this file.
 *
 * Zone color tokens reused from band-block.tsx (CSS variables).
 * THEME-06 flat-warm Raycast design: 6% borders, 12px card radius, Inter.
 * Coral accent on the audienceArchetype tag + "Test full →" CTA.
 */

import { useState } from 'react';
import type { HookCardBlock } from '@/lib/tools/blocks';

export interface HookCardRendererProps {
  block: HookCardBlock;
  /** Optional: Plan 03 wires this to the deep-link handoff (D-05). */
  onTest?: () => void;
}

const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-success)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-error)',
};

export function HookCardRenderer({ block, onTest }: HookCardRendererProps) {
  const {
    hookLine,
    audienceArchetype,
    mechanism,
    seedHook,
    rank,
    band,
    fraction,
    scrollQuote,
    channel,
  } = block.props;

  const [expanded, setExpanded] = useState(false);
  const bandColor = BAND_COLOR[band];

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0 1px 0 0 inset' }}
      aria-label={`Hook #${rank}: ${hookLine.slice(0, 60)}`}
    >
      {/* FACE — always visible (D-11) */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">

        {/* Rank badge + audience-archetype tag row */}
        <div className="flex items-center justify-between gap-2">
          {/* Rank ordinal badge */}
          <span
            className="shrink-0 text-xs font-semibold tabular-nums"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            aria-label={`Rank ${rank}`}
          >
            #{rank}
          </span>

          {/* Audience-archetype tag chip (D-03) — the headline differentiator */}
          <span
            className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{
              color: '#FF7F50',
              borderColor: 'rgba(255,127,80,0.3)',
              backgroundColor: 'rgba(255,127,80,0.08)',
            }}
            title="The audience persona this hook grabs"
            aria-label={`Audience archetype: ${audienceArchetype}`}
          >
            {audienceArchetype}
          </span>
        </div>

        {/* Hook line — dominant face element */}
        <p className="text-base font-semibold text-foreground leading-snug">
          {hookLine}
        </p>

        {/* Lead scroll-quote — the primary SIM signal (D-02/D-04) */}
        <blockquote
          className="border-l-2 border-white/[0.12] pl-3 text-sm text-foreground/80 italic leading-snug"
          aria-label="Audience scroll quote"
        >
          &ldquo;{scrollQuote}&rdquo;
        </blockquote>

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
            aria-label={expanded ? 'Collapse hook details' : 'Expand hook details'}
          >
            {expanded ? '↑ Less' : '↓ Details'}
          </button>
        </div>
      </div>

      {/* EXPAND — tap to reveal mechanism, seedHook, channel (D-08) */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-3">

          {/* Mechanism — private craft reasoning surfaced as prose (D-04/D-08) */}
          <div>
            <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Why it works</p>
            <p className="text-sm text-foreground/90 leading-snug">{mechanism}</p>
          </div>

          {/* Seed hook — the line the SIM reacted to */}
          {seedHook !== hookLine && (
            <div>
              <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Seed hook</p>
              <p className="text-sm text-foreground/80 leading-snug">{seedHook}</p>
            </div>
          )}

          {/* Channel — multi-modal delivery hint (if present) */}
          {channel && (
            <div>
              <p className="text-xs text-muted/60 uppercase tracking-wide mb-1">Delivery</p>
              <p className="text-sm text-foreground/80 leading-snug capitalize">{channel}</p>
            </div>
          )}
        </div>
      )}

      {/* "Test full →" CTA (D-05) — affordance + onTest seam (Plan 03 wires deep-link) */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={onTest}
          disabled={!onTest}
          className="text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          style={{
            color: onTest ? '#FF7F50' : 'rgba(255,127,80,0.35)',
            cursor: onTest ? 'pointer' : 'default',
          }}
          aria-label="Test this hook on the full SIM-1 Max pipeline"
          title={onTest ? 'Test this hook on SIM-1 Max' : 'Test full wiring lands in Plan 03'}
        >
          Test full →
        </button>
      </div>
    </div>
  );
}
