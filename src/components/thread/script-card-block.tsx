'use client';

/**
 * ScriptCardRenderer — beat-structured script card (D-02/D-05/THREAD-04).
 *
 * Design constraints (THREAD-04):
 *  - The model emits validated ScriptCardBlock props only; THIS component owns layout.
 *  - No model-generated markup, no dynamic component selection.
 *
 * Card anatomy:
 *  FACE (always visible):
 *    beats list — each beat shows label · content · timing · retentionMarker line
 *  SECONDARY CHIP (Pitfall 5 honesty spine — OPENER ONLY):
 *    band + fraction + "opener stops the scroll" copy + SIM-1 Flash tag
 *    This signal describes the opener beat only — NOT full-watch or general retention.
 *  CTA (D-05): "Test full →" — seam for 06-05 to wire the script→test context.
 *    Reads from a ScriptTestContext (same pattern as HookTestContext in HooksThreadView).
 *    Renders as a stub when context is null (mirroring HookCardRenderer plan-01 behavior).
 *
 * THEME-06 flat-warm Raycast design: 6% borders, 12px card radius, Inter.
 * Coral accent on the CTA only — NOT on beat labels or retention chips.
 */

import { useState } from 'react';
import type { ScriptCardBlock } from '@/lib/tools/blocks';
import { useOnTestScript } from '@/lib/script-test-context';

export interface ScriptCardRendererProps {
  block: ScriptCardBlock;
  /** Optional: wired by Plan 06-05 to route script→Test handoff.
   *  When absent, reads from ScriptTestContext; falls back to stub if neither present. */
  onTest?: () => void;
}

const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-success)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-error)',
};

/** Beat label → subtle ordinal color (no coral — coral is CTA only) */
const BEAT_LABEL_STYLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.50)',
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
};

export function ScriptCardRenderer({ block, onTest: onTestProp }: ScriptCardRendererProps) {
  const {
    beats,
    openingBeatSeed,
    band,
    fraction,
    scrollQuote,
  } = block.props;

  // Read ScriptTestContext — enables ScriptThreadView to provide the handler without
  // prop-drilling through MessageBlocks (mirrors HookCardRenderer + HookTestContext).
  const onTestCtx = useOnTestScript();

  // Resolve: explicit prop > context > null (stub)
  const resolvedOnTest = onTestProp ?? (onTestCtx
    ? () => {
        // Build script brief from opener seed + first beat content
        const openerLine = openingBeatSeed || (beats[0]?.content ?? '');
        const brief = beats.map((b) => `[${b.label}] ${b.content}`).join(' / ').slice(0, 400);
        onTestCtx(openerLine, brief);
      }
    : undefined);

  // Alias for cleaner JSX below
  const onTest = resolvedOnTest;

  const [expandedBeats, setExpandedBeats] = useState<Set<number>>(new Set([0]));
  const bandColor = BAND_COLOR[band];

  function toggleBeat(index: number) {
    setExpandedBeats((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0 1px 0 0 inset' }}
      aria-label="Script card"
    >
      {/* OPENER SIGNAL — scrollQuote from Flash opener gate (Pitfall 5: opener-only) */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        <blockquote
          className="border-l-2 border-white/[0.12] pl-3 text-sm text-foreground/80 italic leading-snug"
          aria-label="Audience opener quote"
        >
          &ldquo;{scrollQuote}&rdquo;
        </blockquote>

        {/* Opener band chip — scoped to the OPENER only (Pitfall 5 honesty spine) */}
        <div
          className="flex items-center gap-2 text-xs"
          aria-label={`Opener: ${band} pull — ${fraction} — SIM-1 Flash`}
          title="Opener-only signal — describes how the opening beat stops the scroll, not full-video retention"
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
          {/* Honesty scope label: opener only, never "video" or "retention" */}
          <span className="text-muted/50">opener stops the scroll</span>
          <span className="text-muted/40">·</span>
          <span className="text-muted/50">SIM-1 Flash</span>
        </div>
      </div>

      {/* BEATS LIST — Hook→Setup→Turn→Payoff→CTA (D-02) */}
      <div className="border-t border-white/[0.06] flex flex-col divide-y divide-white/[0.04]">
        {beats.map((beat, index) => {
          const isExpanded = expandedBeats.has(index);
          return (
            <div key={index} className="px-4 py-3 flex flex-col gap-2">
              {/* Beat header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Beat label */}
                  <span style={BEAT_LABEL_STYLE} aria-label={`Beat: ${beat.label}`}>
                    {beat.label}
                  </span>
                  {/* Timing badge */}
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: 'rgba(255,255,255,0.30)' }}
                    aria-label={`Timing: ${beat.timing}`}
                  >
                    {beat.timing}
                  </span>
                </div>
                {/* Expand toggle to show retentionMarker craft reasoning */}
                <button
                  type="button"
                  onClick={() => toggleBeat(index)}
                  className="text-xs text-muted/60 hover:text-muted transition-colors"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Collapse ${beat.label} details` : `Expand ${beat.label} details`}
                >
                  {isExpanded ? '↑' : '↓'}
                </button>
              </div>

              {/* Beat content — the executable script text */}
              <p className="text-sm text-foreground/90 leading-snug">
                {beat.content}
              </p>

              {/* RetentionMarker — craft reasoning, expanded on tap (D-02 private scaffold) */}
              {isExpanded && (
                <div className="mt-1">
                  <p
                    className="text-xs text-muted/60 uppercase tracking-wide mb-1"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    Why this beat holds attention
                  </p>
                  <p className="text-xs text-foreground/70 leading-snug italic">
                    {beat.retentionMarker}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Opening beat seed — the line fed to the Flash hook-beat gate (D-01) */}
      {openingBeatSeed && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="text-xs text-muted/60 uppercase tracking-wide mb-1" style={{ letterSpacing: '0.06em' }}>
            Opener seed
          </p>
          <p className="text-sm text-foreground/70 leading-snug">
            {openingBeatSeed}
          </p>
        </div>
      )}

      {/* "Test full →" CTA (D-05) — seam for Plan 06-05 to wire script→test handoff */}
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
          aria-label="Test this script on the full SIM-1 Max pipeline"
          title={onTest ? 'Test this script on SIM-1 Max' : 'Test full wiring lands in Plan 06-05'}
        >
          Test full →
        </button>
      </div>
    </div>
  );
}
