'use client';

import { useState } from 'react';
import type { HeatmapPayload, PersonaSimulationResult } from '@/lib/engine/types';
import { resolveKeyframeUrl, type KeyframeSegmentLike } from '@/components/board/_kit';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import { formatTime, totalDuration } from '@/components/board/audience/audience-derive';
import { ScoreGauge } from './score-gauge';
import { ReadingSection, READING_CARD } from './reading-section';
import { AudienceBreakout } from './audience-breakout';

// ReadingHero — "TEST" scorecard (hero v6, D-06 Test reframe 2026-06-18). A tight,
// centered cluster: the video poster + the score gauge + a 3-stat strip
// (Watch-through · Biggest drop · Niche rank). Replaces the old gauge | dot-cloud
// hero (the cloud moves to its own AudienceOrbit card below).
//
// D-06 BOUNDED RENAME: hero section label = "Test"; powered-by tag = "powered by SIM-1 Max".
// Presentation only — score math, ScoreGauge, ENGINE_VERSION, reading_id, route paths
// are all UNCHANGED. The "SIM-1 Max" tag is chrome, NOT a data import.
//
// HONESTY (D-13): every stat omits itself when its value is genuinely underivable
// — never a fabricated 0 / "Top —%". The poster shows the real first keyframe when
// one exists, else a neutral gradient placeholder (chrome, not data). Display-only:
// nothing here is a tap target (all drill-downs live in the accordion).
//
// Desktop: poster + gauge + stats sit as one centered unit (symmetric breathing
// room, no one-sided void). Mobile (<520px): the stats drop under the poster+gauge
// as a horizontal 3-column strip.

const POSTER_PLACEHOLDER =
  'radial-gradient(120% 80% at 35% 25%, #3a3733, #221f1d 72%)';

export interface ReadingHeroProps {
  /** 0–100 overall score (already past the D-13 gate — a real number). */
  score: number;
  /** Hero-owned watch-through %, 0–100. null ⇒ the stat is omitted. */
  watch: number | null;
  /** Biggest-drop time in SECONDS. null ⇒ the stat is omitted. */
  dropT: number | null;
  /** Finish rate (% of the audience who watch to the end), 0–100. null ⇒ omitted.
   *  Always-derivable third stat (niche rank needs a cross-user cohort it rarely has). */
  finishRate: number | null;
  /** Heatmap — source of the poster keyframe + total duration + the folded audience. */
  heatmap: HeatmapPayload | null;
  /** Persona sim results — feeds the folded "How far it gets pushed" cascade. */
  simResults?: PersonaSimulationResult[];
  /** Half-basis read → a small "partial" note under the gauge (D-13). */
  partial?: boolean;
}

interface Stat {
  key: string;
  value: string;
  label: string;
  amber?: boolean;
  /** Stable testid for the watch stat (test continuity with the old caption). */
  testid?: string;
}

function asKeyframeSegments(
  segments: HeatmapPayload['segments'] | undefined,
): KeyframeSegmentLike[] {
  return (segments ?? []).map((s, i) => ({
    idx: s.idx ?? i,
    t_start: s.t_start,
    t_end: s.t_end,
    keyframe_uri: s.keyframe_uri,
  }));
}

/** Small 9:16 poster: the real first keyframe when available, else a neutral
 *  gradient frame. A failed image collapses back to the placeholder (no broken box). */
function HeroPoster({ heatmap }: { heatmap: HeatmapPayload | null }) {
  const [failed, setFailed] = useState(false);
  const filmstrips = usePermalinkFilmstrips();
  const src = resolveKeyframeUrl(filmstrips, asKeyframeSegments(heatmap?.segments), 'first');
  const segs = heatmap?.segments ?? [];
  const duration = segs.length > 0 ? formatTime(totalDuration(segs, 0)) : null;
  const showImg = !!src && !failed;

  return (
    <div
      className="relative aspect-[9/16] w-[86px] shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)]"
      style={showImg ? undefined : { background: POSTER_PLACEHOLDER }}
    >
      {showImg ? (
        // signed, dynamic keyframe URL — plain <img>, decorative alt (T-02-03).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-white/[0.1] bg-black/30">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="var(--color-foreground)" aria-hidden>
              <path d="M3 2l9 5-9 5z" />
            </svg>
          </span>
        </span>
      )}
      {duration && (
        <span className="absolute bottom-1.5 left-1.5 rounded-xs bg-black/40 px-1.5 py-px text-[10px] tabular-nums text-foreground-secondary">
          {duration}
        </span>
      )}
    </div>
  );
}

export function ReadingHero({
  score,
  watch,
  dropT,
  finishRate,
  heatmap,
  simResults,
  partial,
}: ReadingHeroProps) {
  const stats: Stat[] = [];
  if (watch != null)
    stats.push({ key: 'watch', value: `${watch}%`, label: 'Watch-through', testid: 'reading-watch' });
  if (dropT != null)
    stats.push({ key: 'drop', value: formatTime(dropT), label: 'Biggest drop', amber: true });
  if (finishRate != null)
    stats.push({ key: 'finish', value: `${finishRate}%`, label: 'Finish rate', testid: 'reading-finish' });

  return (
    <ReadingSection
      label="Test"
      labelSuffix={
        <span
          className="ml-1.5 rounded-xs border px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.05em]"
          style={{
            borderColor: 'var(--color-cream-secondary)',
            color: 'var(--color-cream-secondary)',
            opacity: 0.75,
          }}
        >
          powered by SIM-1 Max
        </span>
      }
      card={false}
    >
      {/* B+tweak (2026-07-18): the hero card holds ONLY the score cluster (poster + gauge +
          3 stats) so the score is the one unmistakable focal moment. "How far it gets pushed"
          is pulled OUT, below the card, as a borderless column block — it was making the hero
          card tall and diluting the focal point. */}
      <div data-testid="reading-hero" className="flex flex-col gap-5">
        <div className={READING_CARD}>
        {/* hero-top: poster + gauge + stats, one centered cluster */}
        <div className="flex flex-col items-stretch gap-0 p-[18px] min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-center min-[520px]:gap-6 min-[520px]:p-6">
          {/* poster + gauge — always side by side, centered */}
          <div className="flex items-center justify-center gap-5 pb-[18px] min-[520px]:pb-0">
            <HeroPoster heatmap={heatmap} />
            <div className="flex flex-col items-center gap-1.5">
              <ScoreGauge score={score} size={128} />
              {partial && (
                <p data-testid="reading-partial" className="text-[11px] text-foreground-muted">
                  Partial read — half the usual signals.
                </p>
              )}
            </div>
          </div>

          {/* stat strip — vertical on desktop (left divider), horizontal under on mobile */}
          {stats.length > 0 && (
            <div className="flex flex-row border-t border-[var(--color-border)] pt-4 min-[520px]:flex-col min-[520px]:gap-[15px] min-[520px]:border-l min-[520px]:border-t-0 min-[520px]:pl-6 min-[520px]:pt-0">
              {stats.map((s) => (
                <div
                  key={s.key}
                  className="flex-1 px-2 text-center [&:not(:first-child)]:border-l [&:not(:first-child)]:border-[var(--color-border)] min-[520px]:flex-none min-[520px]:px-0 min-[520px]:text-left min-[520px]:[&:not(:first-child)]:border-l-0"
                >
                  <div
                    data-testid={s.testid}
                    className={`text-xl font-semibold leading-none tabular-nums ${s.amber ? 'text-warning' : 'text-foreground'}`}
                  >
                    {s.value}
                  </div>
                  <div className="mt-1 text-[11px] text-foreground-muted">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        {/* Reach overview — "How far it gets pushed", now a borderless column block BELOW the
            hero card (renders null when no cohort is derivable). */}
        <AudienceBreakout heatmap={heatmap} simResults={simResults} dropT={dropT} />
      </div>
    </ReadingSection>
  );
}

ReadingHero.displayName = 'ReadingHero';
