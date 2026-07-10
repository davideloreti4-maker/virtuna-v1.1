'use client';

/**
 * HookCardRenderer — hook-line-forward hook card (D-05/D-08/D-11).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte (no inset shine), warm-cream tokens, band color used once.
 *  - Eyebrow archetype kicker (band-colored dot) ABOVE the hero hook → hook reads first.
 *  - Why-teaser (mechanism) surfaced on the face; seed + delivery on expand.
 *  - ONE shared <ProofUnit> = the visible AudienceLens entry ("See the room →").
 *  - ONE forward action = the cream primary "Write script →" (§1.7) + Save icon. There is NO
 *    "Test full →" here (removed 2026-06-27): a hook is only an opener, and its handoff sent
 *    the same lone line already Flash-read — "full" referred to nothing. Deep-testing the
 *    *full script* on SIM-1 Max is the Script card's terminal step, where "full" is honest.
 *  - The dead "If this could flop →" branch is GONE — predictedFailureMode is always null
 *    (the rubric-critic that fed it was removed in S5), so it never rendered.
 *
 * THREAD-04 / D-11: the model emits validated HookCardBlock props only; THIS component owns
 * layout. No model-generated markup, no dynamic component selection.
 */

import { useState } from 'react';
import type { HookCardBlock } from '@/lib/tools/blocks';
import { useOnWriteScriptHook } from '@/lib/hook-test-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { BAND_COLOR } from './band-block';
import { ProofUnit } from './proof-unit';
import { SaveAffordance } from '@/components/thread/save-affordance';

export interface HookCardRendererProps {
  block: HookCardBlock;
  /** Optional override for the hooks→script handoff (CHAIN_HANDOFFS hooks→script).
   *  When absent, the callback is read from HookWriteScriptContext. */
  onWriteScript?: () => void;
}

/** §11f fit glyph + plain-language label for the proof receipt (§11c degradation ladder). */
const FIT_META: Record<'in-audience' | 'adjacent' | 'structural', { glyph: string; label: string }> = {
  'in-audience': { glyph: '●', label: 'in your audience' },
  adjacent: { glyph: '◐', label: 'adjacent audience' },
  structural: { glyph: '○', label: 'cross-niche structure' },
};

function fmtViews(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtMultiplier(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '';
  return m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/**
 * The on-card proof receipt (§11f receipts-on-cards) — the visible payoff of grounded generation.
 * Renders "◐ Proven by @handle · 90× vs followers · 621K views ↗", links to the real video when we
 * have the URL. Numbers we don't have are simply omitted (a caption-tier row may lack a multiplier);
 * we never fabricate a stat. Rendered ONLY when a real source was attributed (honesty spine).
 */
function HookProofReceipt({ proof }: { proof: NonNullable<HookCardBlock['props']['proof']> }) {
  const fit = FIT_META[proof.fitLabel];
  const mult = fmtMultiplier(proof.multiplier);
  const views = fmtViews(proof.views);
  const stats = [
    mult ? `${mult}${proof.baselineLabel ? ` ${proof.baselineLabel}` : ''}` : null,
    views ? `${views} views` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const inner = (
    <>
      <span className="shrink-0 text-foreground-muted" aria-hidden="true">{fit.glyph}</span>
      <span className="font-medium text-foreground-secondary">
        Proven by <span className="text-foreground">@{proof.handle}</span>
      </span>
      {stats && <span className="text-foreground-muted">· {stats}</span>}
      {proof.videoUrl && <span className="ml-auto shrink-0 text-foreground-muted" aria-hidden="true">↗</span>}
    </>
  );

  const base =
    'flex items-center gap-1.5 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] leading-none';
  const aria = `Proof video by @${proof.handle}${stats ? `, ${stats}` : ''} — match: ${fit.label}`;

  return proof.videoUrl ? (
    <a
      href={proof.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} transition-colors hover:border-white/[0.10] hover:bg-white/[0.035]`}
      title={`${fit.label} — open the proof video`}
      aria-label={`${aria}. Opens in a new tab.`}
    >
      {inner}
    </a>
  ) : (
    <div className={base} title={fit.label} aria-label={aria}>
      {inner}
    </div>
  );
}

export function HookCardRenderer({ block, onWriteScript: onWriteScriptProp }: HookCardRendererProps) {
  const {
    hookLine,
    audienceArchetype,
    mechanism,
    seedHook,
    rank,
    band,
    fraction,
    scored,
    scrollQuote,
    channel,
    proof,
  } = block.props;

  // hooks→script handoff (CHAIN_HANDOFFS hooks→script — "Write script →", the forward chain).
  // The prop override takes precedence if explicitly passed.
  const onWriteScriptFromCtx = useOnWriteScriptHook();
  const onWriteScript = onWriteScriptProp ?? (onWriteScriptFromCtx
    ? () => onWriteScriptFromCtx(hookLine, audienceArchetype)
    : undefined);

  const [expanded, setExpanded] = useState(false);
  const bandColor = BAND_COLOR[band];

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Hook #${rank}: ${hookLine.slice(0, 60)}`}
    >
      {/* FACE — always visible (D-11) */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Eyebrow — archetype kicker (band-colored dot) + rank. The hook reads first. */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-foreground-muted">
            <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: bandColor }} aria-hidden="true" />
            {audienceArchetype}
          </span>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground-muted" aria-label={`Rank ${rank}`}>
            #{rank}
          </span>
        </div>

        {/* Hook line — the hero */}
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
          {hookLine}
        </p>

        {/* Proof receipt (§11f) — the real outlier this hook's structure was drawn from. Only
            present on grounded runs where a real source was attributed (honesty spine). */}
        {proof && <HookProofReceipt proof={proof} />}

        {/* Why-teaser — the mechanism surfaced on the face (full reasoning, clamped). */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-foreground-secondary">
          <span className="text-foreground-muted">Why it works — </span>
          {mechanism}
        </p>

        {/* Proof unit — the single audience-reaction block + visible Lens entry. */}
        <ProofUnit
          band={band}
          fraction={fraction}
          scored={scored ?? true}
          quote={scrollQuote}
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
        />

        {/* Expand toggle — clearer affordance, with the provenance demoted onto this line. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse hook details' : 'Expand hook details'}
        >
          <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
          {expanded ? 'Hide details' : 'Why & details'}
          <span className="text-foreground-muted/70">· SIM-1 Flash</span>
        </button>
      </div>

      {/* EXPAND — seed + delivery (the mechanism already leads the face). */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          {seedHook !== hookLine && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Seed hook</p>
              <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{seedHook}</p>
            </div>
          )}
          {channel && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Delivery</p>
              <p className="text-[13.5px] capitalize leading-relaxed text-foreground-secondary">{channel}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions — one cream primary (forward chain) + secondary text + Save icon. */}
      <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-3">
        {/* "Write script →" — the forward chain step (hooks→script), cream primary (§1.7). */}
        <button
          type="button"
          onClick={onWriteScript}
          disabled={!onWriteScript}
          className="rounded-[8px] bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-default disabled:opacity-40"
          aria-label="Write a full script from this hook"
          title={onWriteScript ? 'Write a full script anchored on this hook' : 'Write script handoff not wired'}
        >
          Write script →
        </button>

        {/* Save (Act→State) — save this hook to the shelf (snapshot = block props). */}
        <SaveAffordance className="ml-auto" item_type="hook" title={hookLine} snapshot={block.props} />
      </div>
    </div>
  );
}
