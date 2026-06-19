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
import { useOnTestHook, useOnWriteScriptHook } from '@/lib/hook-test-context';
import { LensTrigger } from '@/components/audience-lens/LensTrigger';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { SaveAffordance } from '@/components/thread/save-affordance';

export interface HookCardRendererProps {
  block: HookCardBlock;
  /** Optional override: Plan 03 wires this to the deep-link handoff (D-05).
   *  When absent, the callback is read from HookTestContext (provided by HooksThreadView).
   *  When both are absent, the button renders as a stub (Plan 01 behavior). */
  onTest?: () => void;
  /** Optional override for the hooks→script handoff (CHAIN_HANDOFFS hooks→script).
   *  When absent, the callback is read from HookWriteScriptContext (provided by HooksThreadView).
   *  When both are absent, the button renders as a stub. */
  onWriteScript?: () => void;
}

const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-success)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-error)',
};

export function HookCardRenderer({ block, onTest: onTestProp, onWriteScript: onWriteScriptProp }: HookCardRendererProps) {
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
    predictedFailureMode,
  } = block.props;

  // Read the handoff callbacks from context (provided by HooksThreadView).
  // The prop overrides take precedence if explicitly passed.
  const onTestFromCtx = useOnTestHook();
  const onTest = onTestProp ?? (onTestFromCtx
    ? () => onTestFromCtx(hookLine, audienceArchetype)
    : undefined);

  // hooks→script handoff (CHAIN_HANDOFFS hooks→script — "Write script →").
  const onWriteScriptFromCtx = useOnWriteScriptHook();
  const onWriteScript = onWriteScriptProp ?? (onWriteScriptFromCtx
    ? () => onWriteScriptFromCtx(hookLine, audienceArchetype)
    : undefined);

  const [expanded, setExpanded] = useState(false);
  // KCQ-04 (D-10): opt-in flop reveal — a second drill INSIDE the disclosure.
  const [flopOpen, setFlopOpen] = useState(false);
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

        {/* Lead scroll-quote — the primary SIM signal (D-02/D-04). Tapping it opens the
            single reusable AudienceLens inline (cascade mode, D-06/D-04). */}
        {/* NOTE: `audienceArchetype` is a HUMAN-FACING display label ("Stops the skeptic"),
            NOT a persona-registry enum — so it is intentionally NOT passed as the chat-grounding
            archetype (CR-01). A label leaking into personaGrounding.archetype is rejected by the
            chat route and breaks the in-voice answer + rehydration. The hook card carries no
            registry enum, so the Lens correctly gates "Ask them why →" off on this surface. */}
        <LensTrigger
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={hookLine}
          rewrite={buildCardRewrite({
            skill: 'hooks',
            fraction,
            scrollQuote,
            conceptText: hookLine,
            platform: 'tiktok',
          })}
          label="See how the room reacted to this hook"
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

          {/* KCQ-04 (D-10) — opt-in predicted-failure-mode reveal. Renders ONLY when
              predictedFailureMode is non-null, and only here INSIDE the disclosure
              (never on the always-visible face). A further drill gates the text itself,
              so it is opt-in, never silent-only. Warning-toned (--color-warning) — never
              coral, never error-red (honesty-spine tone). */}
          {predictedFailureMode != null && (
            <div>
              <button
                type="button"
                onClick={() => setFlopOpen((v) => !v)}
                className="text-xs font-medium transition-opacity hover:opacity-80 focus-visible:outline-none"
                style={{ color: 'var(--color-warning)' }}
                aria-expanded={flopOpen}
                aria-label={flopOpen ? 'Hide why this hook might miss' : 'Reveal why this hook might miss'}
              >
                {flopOpen ? '↑ Hide the risk' : 'If this could flop →'}
              </button>
              {flopOpen && (
                <p
                  className="mt-1 text-sm leading-snug"
                  style={{ color: 'var(--color-warning)', opacity: 0.85 }}
                  aria-label="Predicted failure mode"
                >
                  {predictedFailureMode}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chain CTAs (D-05): "Write script →" (hooks→script) + "Test full →" (hooks→test).
          Both seams read from context (HooksThreadView provides them). */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-4">
        {/* Save (Act→State) — save this hook to the shelf (snapshot = block props) */}
        <SaveAffordance item_type="hook" title={hookLine} snapshot={block.props} />

        {/* "Write script →" — hooks→script chain handoff (CHAIN_HANDOFFS) */}
        <button
          type="button"
          onClick={onWriteScript}
          disabled={!onWriteScript}
          className="text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          style={{
            color: onWriteScript ? '#FF7F50' : 'rgba(255,127,80,0.35)',
            cursor: onWriteScript ? 'pointer' : 'default',
          }}
          aria-label="Write a full script from this hook"
          title={onWriteScript ? 'Write a full script anchored on this hook' : 'Write script handoff not wired'}
        >
          Write script →
        </button>

        {/* "Test full →" — hooks→test handoff (onTest seam) */}
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
