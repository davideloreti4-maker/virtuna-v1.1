'use client';
/**
 * DecodeShellNode — Decode frame body for remix mode.
 *
 * Renders: 4 stacked labeled beat blocks + 2 lanes (repeatable + luck).
 * Dual-read: live SSE stream (variants.remix.decode) + permalink direct read.
 *
 * m3 fix: overall_score is null on decode rows — use-analysis-stream short-circuit
 * (line 127, overall_score != null) never fires for remix rows. Read
 * permalinkData.variants.remix.decode directly as the fallback.
 *
 * T-03-07: All decode strings rendered via JSX text children — React auto-escapes.
 * D-06/D-07: No advice verbs (fix/improve/should/try/consider) in rendered copy.
 *             No "you" outside the sanctioned "What you can repeat" lane header.
 */

import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { BEAT_IDS, type BeatId, type DecodeResult, type LuckCategory } from '@/lib/engine/remix/decode-types';

// =====================================================
// Display maps — locked per 03-UI-SPEC.md §Copywriting Contract
// =====================================================

const BEAT_LABELS: Record<BeatId, string> = {
  hook_pattern: 'Hook pattern',
  structure_pacing: 'Structure & pacing',
  the_turn: 'The turn',
  emotional_beat: 'Emotional beat',
};

const LUCK_CATEGORY_LABELS: Record<LuckCategory, string> = {
  timing_trend_moment: 'timing / trend-moment',
  existing_audience_reach: 'existing audience reach',
  algorithmic_outlier: 'algorithmic outlier',
  topic_zeitgeist: 'topic / zeitgeist',
};

// =====================================================
// In-flight state — honest skeleton (no fake beat/bullet skeletons)
// =====================================================

function DecodingState() {
  return (
    <div className="flex flex-col gap-2" data-testid="decode-skeleton">
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/45 motion-safe:animate-skeleton-breathe">
        Decoding structure…
      </span>
      <span className="text-[44px] font-semibold leading-none tabular-nums text-white/25 motion-safe:animate-skeleton-breathe">
        —
      </span>
    </div>
  );
}

// =====================================================
// Error state
// =====================================================

function DecodeErrorState() {
  return (
    <div className="flex flex-col gap-2" data-testid="decode-error">
      <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-white/45">
        Decode unavailable
      </div>
      <p
        className="text-[13px] leading-[1.4] text-white/45"
        style={{ textWrap: 'balance' } as React.CSSProperties}
      >
        Structural analysis couldn&apos;t complete. The breakdown will appear when it&apos;s ready.
      </p>
    </div>
  );
}

// =====================================================
// Decoded body — beats + lanes
// =====================================================

function DecodedBody({ decode }: { decode: DecodeResult }) {
  // Index beats by id for fixed-order rendering regardless of array order
  const beatMap = new Map(decode.beats.map((b) => [b.id, b]));

  return (
    <div className="flex flex-col gap-4">
      {/* Beat list — 4 blocks in fixed BEAT_IDS order */}
      <div className="flex flex-col">
        {BEAT_IDS.map((id, i) => {
          const beat = beatMap.get(id);
          if (!beat) return null;
          const isLast = i === BEAT_IDS.length - 1;
          const bodyClass =
            beat.verdict === 'present'
              ? 'text-[13px] leading-[1.4] text-white/60'
              : 'text-[13px] leading-[1.4] text-white/35';

          return (
            <div
              key={id}
              className={`pb-4${isLast ? ' last:pb-0' : ''} ${isLast ? '' : 'border-b border-white/[0.06]'} ${isLast ? '' : 'mb-4'}`}
              data-testid={`beat-block-${id}`}
            >
              <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-white/45">
                {BEAT_LABELS[id]}
              </div>
              <p
                className={bodyClass}
                style={{ textWrap: 'balance' } as React.CSSProperties}
                data-testid="beat-body"
              >
                {beat.body}
              </p>
            </div>
          );
        })}
      </div>

      {/* Lanes divider */}
      <div className="mt-6 border-t border-white/[0.06] pt-4">
        <div className="flex flex-col gap-4">
          {/* Lane 1 — What you can repeat */}
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.08em] text-white/45">
              What you can repeat
            </div>
            <div className="flex flex-col gap-2">
              {decode.repeatable.map((item, i) => (
                <div key={i} className="pl-3 text-[13px] text-white/60" data-testid="repeatable-bullet">
                  <span className="text-white/25">— </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Lane 2 — What was luck / timing */}
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.08em] text-white/45">
              What was luck / timing
            </div>
            <div className="flex flex-col gap-3">
              {decode.luck.map((item, i) => (
                <div key={i} className="flex flex-col gap-1" data-testid="luck-item">
                  <span className="text-[11px] font-medium text-white/40">
                    {LUCK_CATEGORY_LABELS[item.category]}
                  </span>
                  <p
                    className="text-[13px] leading-[1.5] text-white/55"
                    data-testid="luck-note"
                  >
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Main component
// =====================================================

export function DecodeShellNode() {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const { result, phase } = stream;

  const isDecoding =
    phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  // Cast stream result to access variants.remix.decode
  // NOTE: overall_score is null on decode rows — do NOT use it as completion signal (m3)
  const row = result as unknown as {
    variants?: { remix?: { decode?: DecodeResult } };
  } | null;

  // m3: direct permalink read when the stream result lacks decode
  // (use-analysis-stream short-circuit at line 127 never fires for overall_score:null rows)
  const decode: DecodeResult | null =
    row?.variants?.remix?.decode ??
    (
      permalinkData as {
        variants?: { remix?: { decode?: DecodeResult } };
      } | null
    )?.variants?.remix?.decode ??
    null;

  return (
    <div
      aria-busy={isDecoding}
      className="relative flex w-full flex-col gap-2"
      data-testid="decode-shell"
    >
      {decode != null ? (
        <DecodedBody decode={decode} />
      ) : isDecoding ? (
        <DecodingState />
      ) : (
        <DecodeErrorState />
      )}
    </div>
  );
}
