'use client';

/**
 * ScriptCardRenderer — beat-structured script card (D-02/D-05/THREAD-04).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte, warm-cream, band color used once.
 *  - Eyebrow kicker "Opener stops the scroll" + beat-count meta.
 *  - ONE shared <ProofUnit> labelled "opener only" (honesty spine — the fraction describes
 *    the opening beat's scroll-stop, NOT full-watch retention).
 *  - Beats = quiet bordered rows; retention reasoning inline on expand (no per-beat color).
 *  - ONE cream primary = the chain's terminal step "Test full script →" (§1.7) — deep-tests
 *    the WHOLE script on SIM-1 Max vs the opener-only Flash read shown above; Save = icon.
 *    ("full script", not "full video" — the uploaded-video read is the separate /analyze Read.)
 *
 * THREAD-04: the model emits validated ScriptCardBlock props only; THIS component owns layout.
 */

import { useState } from 'react';
import { Copy, Check, VideoCamera } from '@phosphor-icons/react';
import type { ScriptCardBlock } from '@/lib/tools/blocks';
import { useOnTestScript } from '@/lib/script-test-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { ProofUnit } from './proof-unit';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar, SECTION_LABEL } from './card-primitives';
import { CaretToggle } from './caret-toggle';

export interface ScriptCardRendererProps {
  block: ScriptCardBlock;
  /** Optional: wired by Plan 06-05 to route script→Test handoff.
   *  When absent, reads from ScriptTestContext; falls back to stub if neither present. */
  onTest?: () => void;
}

export function ScriptCardRenderer({ block, onTest: onTestProp }: ScriptCardRendererProps) {
  const { beats, openingBeatSeed, topic, format, production, band, fraction, scrollQuote, proof, grounded, population } = block.props;

  // The topic·format meta line (a script realizes a topic in a format). Either may be absent.
  const metaBits = [format, topic].filter((s): s is string => typeof s === 'string' && s.length > 0);

  // Read ScriptTestContext — enables ScriptThreadView to provide the handler without
  // prop-drilling through MessageBlocks (mirrors HookCardRenderer + HookTestContext).
  const onTestCtx = useOnTestScript();

  // Resolve: explicit prop > context > null (stub)
  const onTest = onTestProp ?? (onTestCtx
    ? () => {
        const openerLine = openingBeatSeed || (beats[0]?.content ?? '');
        const brief = beats.map((b) => `[${b.label}] ${b.content}`).join(' / ').slice(0, 400);
        onTestCtx(openerLine, brief);
      }
    : undefined);

  const [expandedBeats, setExpandedBeats] = useState<Set<number>>(new Set([0]));

  function toggleBeat(index: number) {
    setExpandedBeats((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // Copy the WHOLE beat sheet — a script is the one Make output you want to lift in full (the
  // Hook card copies a single line; here Copy grabs every beat). Clipboard guarded for happy-dom.
  const [copied, setCopied] = useState(false);
  function handleCopyScript() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const scriptText = beats
      .map((b) => `[${b.label} · ${b.timing}]\n${b.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(scriptText).then(
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
      aria-label="Script card"
    >
      {/* HEADER — a script IS a beat sheet, so the card names it and offers Copy-the-whole-thing
          (owner 2026-07-22: each Make card should lead with its own value; the script's value is
          the beat STRUCTURE). Grounding receipt sits under it when the run was sourced. */}
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className={SECTION_LABEL}>
              {beats.length} {beats.length === 1 ? 'beat' : 'beats'}
            </p>
            {/* Topic · Format — a script realizes a topic in a format (owner 2026-07-22). Muted
                meta beside the beat count; each half omitted when absent (honesty). */}
            {metaBits.length > 0 && (
              <>
                <span className="text-foreground-muted/50" aria-hidden="true">·</span>
                <p className="truncate text-[12px] text-foreground-muted">{metaBits.join(' · ')}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopyScript}
            aria-label="Copy the full script to clipboard"
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-foreground-muted transition-colors hover:text-foreground-secondary"
          >
            {copied ? (
              <>
                <Check size={13} weight="bold" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy size={13} aria-hidden="true" />
                Copy script
              </>
            )}
          </button>
        </div>

        {/* Proof receipt (§11f fan-out) — the real outlier this script's structure was drawn from,
            when the run was grounded (honesty spine). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}
      </div>

      {/* BEATS — the SCRIPT CARD'S SIGNATURE: a TIMELINE. A left timing column + a connecting rail
          (dot per beat) read as a shot list, so the script stops looking like the line/brief/decode
          cards. Retention reasoning stays one tap away per beat. */}
      <div className="mt-3 flex flex-col border-t border-white/[0.06] px-4 pt-1">
        {beats.map((beat, index) => {
          const isExpanded = expandedBeats.has(index);
          const isLast = index === beats.length - 1;
          return (
            <div key={index} className="flex gap-3 py-3">
              {/* Timing — the left column of the timeline. */}
              <span className="w-10 shrink-0 pt-px text-right text-[11px] font-semibold tabular-nums text-foreground-secondary">
                {beat.timing}
              </span>

              {/* Rail — a dot on this beat + a line down to the next (omitted on the last). */}
              <div className="flex flex-col items-center" aria-hidden="true">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-white/30" />
                {!isLast && <span className="mt-1 w-px flex-1 bg-white/[0.10]" />}
              </div>

              {/* Beat body — label + content, retention reasoning on expand. */}
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-foreground">
                    {beat.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleBeat(index)}
                    className="shrink-0 text-[12px] text-foreground-muted transition-colors hover:text-foreground-secondary"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Collapse ${beat.label} reasoning` : `Expand ${beat.label} reasoning`}
                  >
                    <CaretToggle open={isExpanded} />
                  </button>
                </div>

                <p className="mt-1 text-[13.5px] leading-relaxed text-foreground-secondary">{beat.content}</p>

                {/* Filming cue — HOW to shoot this beat (camera/framing · b-roll or on-screen
                    text · delivery). Visible by default: this is the value the owner asked for —
                    the script now tells you what to say AND how to film it (owner 2026-07-22).
                    The `retentionMarker` (why it holds) stays on the caret below. */}
                {beat.filming && (
                  <p className="mt-1.5 flex gap-1.5 text-[12px] leading-relaxed text-foreground-muted">
                    <VideoCamera size={13} weight="fill" className="mt-px shrink-0 opacity-70" aria-hidden="true" />
                    <span>{beat.filming}</span>
                  </p>
                )}

                {isExpanded && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-foreground-muted">
                    ↳ {beat.retentionMarker}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* HOW TO FILM — the consolidated production summary (owner chose BOTH per-beat cues AND
          this foot summary). A quiet tone-zone: shot list, on-screen text, setup, edit — the
          creator's shoot checklist once they've read the beats. Absent → nothing (honesty). */}
      {production && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <VideoCamera size={13} weight="fill" className="shrink-0 opacity-70 text-foreground-secondary" aria-hidden="true" />
            <p className={SECTION_LABEL}>How to film</p>
          </div>
          <dl className="mt-2 flex flex-col gap-1.5">
            {[
              { term: 'Shots', value: production.shots },
              { term: 'On-screen text', value: production.onScreenText },
              { term: 'Setup', value: production.setup },
              ...(production.edit ? [{ term: 'Edit', value: production.edit }] : []),
            ].map((row) => (
              <div key={row.term} className="flex gap-2 text-[12.5px] leading-relaxed">
                <dt className="w-[86px] shrink-0 text-foreground-muted">{row.term}</dt>
                <dd className="min-w-0 flex-1 text-foreground-secondary">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Proof unit — the quiet room through-line, opener-only (the fraction is scoped to the
          opening beat, Pitfall 5). Sits BELOW the timeline now: the beats are the hero. */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        <ProofUnit
          band={band}
          fraction={fraction}
          quote={scrollQuote}
          suffix="opener only"
          framed={false}
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={openingBeatSeed || (beats[0]?.content ?? '')}
          population={population}
          rewrite={buildCardRewrite({
            skill: 'script',
            fraction,
            scrollQuote,
            conceptText: openingBeatSeed || (beats[0]?.content ?? ''),
            platform: 'tiktok',
          })}
          label="See how the room reacted to this opener"
        />
      </div>

      {/* Actions — one cream primary (forward chain "Test full →") + Save icon (§0.5.7). */}
      <CardActionBar>
        <CardPrimaryAction
          onClick={onTest}
          disabled={!onTest}
          aria-label="Test the full script on the deeper SIM-1 Max pipeline"
          title={onTest ? 'Test the full script (beyond the opener) on SIM-1 Max' : 'Test full script wiring lands in Plan 06-05'}
        >
          Test this script →
        </CardPrimaryAction>

        <SaveAffordance
          className="ml-auto"
          item_type="script"
          title={openingBeatSeed ?? beats[0]?.content}
          snapshot={block.props}
        />
      </CardActionBar>
    </div>
  );
}
