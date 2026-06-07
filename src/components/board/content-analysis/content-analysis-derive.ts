import type { HookDecomposition, GeminiVideoSignals, GeminiAudioSignals, CtaSegmentResult } from '@/lib/engine/types';
import type { EmotionArcPoint } from '@/lib/engine/qwen/schemas';
import type {
  HookModality,
  CraftPillar,
  CraftPillarKey,
  CraftCell,
  CraftSegment,
  HeadlineClause,
} from './content-analysis-types';
import {
  HOOK_MODALITY_CAPTION,
  HOOK_MODALITY_ORDER,
  CTA_TYPE_LABEL,
  PILLAR_LABELS,
  VERDICT,
  ENERGY,
  AUDIO_MIX,
  COPY,
} from './content-analysis-constants';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** "M:SS" from whole seconds. */
export function formatTimeSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Total duration from the last segment, with a sane fallback. */
export function durationFromSegments(segments: CraftSegment[], fallback = 30): number {
  if (segments.length === 0) return fallback;
  const end = Math.max(...segments.map((s) => s.t_end));
  return end > 0 ? end : fallback;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Composite hook score = mean of the four modality scores (0–10). null if absent. */
export function meanHookScore(decomp: HookDecomposition | null): number | null {
  if (!decomp) return null;
  const vals = HOOK_MODALITY_ORDER.map((k) => decomp[k]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** The strongest modality — names the hook's character in the caption. */
export function strongestModality(decomp: HookDecomposition): HookModality {
  return HOOK_MODALITY_ORDER.reduce((best, k) =>
    decomp[k] > decomp[best] ? k : best,
  );
}

export function hookPillar(decomp: HookDecomposition | null): CraftPillar {
  const score = meanHookScore(decomp);
  return {
    key: 'hook',
    label: PILLAR_LABELS.hook,
    value: score != null ? score.toFixed(1) : '—',
    showDenominator: score != null,
    caption: decomp ? HOOK_MODALITY_CAPTION[strongestModality(decomp)] : '—',
    score,
  };
}

// ── Emotion arc / energy ────────────────────────────────────────────────────

/** Linear-interpolate intensity (0–1) at a timestamp. Neutral 0.5 when no arc. */
export function intensityAt(arc: EmotionArcPoint[], ms: number): number {
  if (arc.length === 0) return 0.5;
  const first = arc[0]!;
  if (arc.length === 1) return clamp01(first.intensity_0_1);
  if (ms <= first.timestamp_ms) return clamp01(first.intensity_0_1);
  const last = arc[arc.length - 1]!;
  if (ms >= last.timestamp_ms) return clamp01(last.intensity_0_1);
  for (let i = 1; i < arc.length; i++) {
    const a = arc[i - 1]!;
    const b = arc[i]!;
    if (ms <= b.timestamp_ms) {
      const span = b.timestamp_ms - a.timestamp_ms || 1;
      const t = (ms - a.timestamp_ms) / span;
      return clamp01(a.intensity_0_1 + (b.intensity_0_1 - a.intensity_0_1) * t);
    }
  }
  return clamp01(last.intensity_0_1);
}

/**
 * Longest contiguous low-energy run, in seconds, if it spans at least
 * MIN_DIP_FRACTION of the video. Drives the Pacing caption ("Energy dips a–b").
 */
export function energyDipWindow(
  arc: EmotionArcPoint[],
  durationSec: number,
): { startSec: number; endSec: number } | null {
  if (arc.length < 3) return null;
  const totalMs = durationSec * 1000;
  let bestStart = -1;
  let bestEnd = -1;
  let bestSpan = 0;
  let runStart = -1;
  for (let i = 0; i < arc.length; i++) {
    const low = arc[i]!.intensity_0_1 <= ENERGY.DIP_CEILING;
    if (low && runStart === -1) runStart = i;
    const runEnds = !low || i === arc.length - 1;
    if (runStart !== -1 && runEnds) {
      const endIdx = low ? i : i - 1;
      const span = arc[endIdx]!.timestamp_ms - arc[runStart]!.timestamp_ms;
      if (span > bestSpan) {
        bestSpan = span;
        bestStart = runStart;
        bestEnd = endIdx;
      }
      runStart = -1;
    }
  }
  if (bestStart === -1 || bestSpan < totalMs * ENERGY.MIN_DIP_FRACTION) return null;
  return { startSec: arc[bestStart]!.timestamp_ms / 1000, endSec: arc[bestEnd]!.timestamp_ms / 1000 };
}

// ── Pacing ────────────────────────────────────────────────────────────────────

export function pacingPillar(
  video: GeminiVideoSignals | null,
  arc: EmotionArcPoint[],
  durationSec: number,
): CraftPillar {
  const score = video?.pacing_score ?? null;
  const dip = energyDipWindow(arc, durationSec);
  let caption = '—';
  if (dip) {
    caption = `Energy dips ${formatTimeSec(dip.startSec)}–${formatTimeSec(dip.endSec)}`;
  } else if (video?.transition_quality != null) {
    const tq = video.transition_quality;
    caption = tq >= VERDICT.STRONG ? 'Smooth transitions' : tq >= VERDICT.MID ? 'Even cuts' : 'Choppy cuts';
  } else if (score != null) {
    caption = score >= VERDICT.STRONG ? 'Holds attention' : 'Steady throughout';
  }
  return {
    key: 'pacing',
    label: PILLAR_LABELS.pacing,
    value: score != null ? score.toFixed(1) : '—',
    showDenominator: score != null,
    caption,
    score,
  };
}

// ── Audio ─────────────────────────────────────────────────────────────────────

/** Mix-profile caption from the 0–1 ratios. Context-dependent (no polarity). */
export function audioMixCaption(audio: GeminiAudioSignals): string {
  if (audio.silence_ratio >= AUDIO_MIX.HIGH_SILENCE) return 'Sparse audio';
  if (audio.voiceover_ratio >= AUDIO_MIX.DOMINANT && audio.voiceover_ratio >= audio.music_ratio)
    return 'Voiceover-led';
  if (audio.music_ratio >= AUDIO_MIX.DOMINANT) return 'Music-led';
  return 'Mixed audio';
}

export function audioPillar(
  perceptual: number | null,
  audio: GeminiAudioSignals | null,
): CraftPillar {
  // 0–100 perceptual → 0–10; else fall back to voice clarity.
  const score = perceptual != null ? perceptual / 10 : audio?.voice_clarity_0_10 ?? null;
  // When there's no speech track (slideshow / b-roll) audio polarity is ambiguous,
  // so it is excluded from weak-link selection (weakScore null) but still shown.
  const hasSpeech = audio != null;
  return {
    key: 'audio',
    label: PILLAR_LABELS.audio,
    value: hasSpeech && score != null ? score.toFixed(1) : '—',
    showDenominator: hasSpeech && score != null,
    caption: hasSpeech ? audioMixCaption(audio) : COPY.AUDIO_NONE_CAPTION,
    score: hasSpeech ? score : null,
  };
}

// ── CTA ─────────────────────────────────────────────────────────────────────

export function ctaPillar(cta: CtaSegmentResult | null): CraftPillar {
  if (!cta || !cta.cta_present) {
    return {
      key: 'cta',
      label: PILLAR_LABELS.cta,
      value: COPY.CTA_NONE_VALUE,
      showDenominator: false,
      // score 0 → a missing close competes as the weak link (usually wins).
      caption: COPY.CTA_NONE_CAPTION,
      score: 0,
    };
  }
  const strength = cta.strength ?? 0;
  return {
    key: 'cta',
    label: PILLAR_LABELS.cta,
    value: strength.toFixed(1),
    showDenominator: true,
    caption: (cta.type ? CTA_TYPE_LABEL[cta.type] : undefined) ?? CTA_TYPE_LABEL.other ?? 'Clear ask',
    score: strength,
  };
}

// ── Pillars + weak link ────────────────────────────────────────────────────

export function buildPillars(args: {
  decomp: HookDecomposition | null;
  video: GeminiVideoSignals | null;
  arc: EmotionArcPoint[];
  perceptual: number | null;
  audio: GeminiAudioSignals | null;
  cta: CtaSegmentResult | null;
  durationSec: number;
}): CraftPillar[] {
  return [
    hookPillar(args.decomp),
    pacingPillar(args.video, args.arc, args.durationSec),
    audioPillar(args.perceptual, args.audio),
    ctaPillar(args.cta),
  ];
}

// Tie-break priority when scores are equal — the most actionable gap wins coral.
const WEAK_PRIORITY: Record<CraftPillarKey, number> = { cta: 0, pacing: 1, audio: 2, hook: 3 };

/** Lowest-scored pillar (score-normalized). Excludes pillars with null score. */
export function selectWeakLink(pillars: CraftPillar[]): CraftPillarKey | null {
  const scored = pillars.filter((p) => p.score != null) as (CraftPillar & { score: number })[];
  if (scored.length === 0) return null;
  let best = scored[0]!;
  for (const p of scored.slice(1)) {
    if (p.score < best.score || (p.score === best.score && WEAK_PRIORITY[p.key] < WEAK_PRIORITY[best.key])) {
      best = p;
    }
  }
  return best.key;
}

// ── Filmstrip grading ─────────────────────────────────────────────────────────

/** CSS filter grading a keyframe by energy: bright+saturated where alive, grey where dead. */
export function energyGradeFilter(intensity: number): string {
  const e = clamp01(intensity);
  return (
    `brightness(${(0.5 + e * 0.62).toFixed(2)}) ` +
    `saturate(${(e * 1.15).toFixed(2)}) ` +
    `grayscale(${((1 - e) * 0.72).toFixed(2)}) ` +
    `contrast(${(0.94 + e * 0.2).toFixed(2)})`
  );
}

/** Filmic fallback gradient when a keyframe URL is missing/failed to load. */
export function fallbackCellGradient(intensity: number): string {
  const e = clamp01(intensity);
  const L = 7 + e * 20;
  const warm = 24 + e * 10;
  const sat = 10 + e * 20;
  const tail = Math.max(4, Math.min(30, L - 3));
  return (
    `radial-gradient(110% 90% at 38% 20%, hsla(${warm}, ${sat + 18}%, ${(24 + e * 34).toFixed(0)}%, .9), transparent 58%), ` +
    `linear-gradient(158deg, hsl(${warm}, ${sat}%, ${(L + 5).toFixed(0)}%), hsl(220, 16%, ${tail.toFixed(0)}%) 75%)`
  );
}

/**
 * Synthetic equal-width segments from streamed keyframe indices, used when
 * heatmap.segments hasn't landed yet (keyframes arrive independently/earlier via
 * SSE). Lets the hero render as soon as frames stream. First cell = the open.
 */
export function segmentsFromFilmstrips(
  filmstrips: Record<number, string>,
  durationSec: number,
): CraftSegment[] {
  const idxs = Object.keys(filmstrips)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (idxs.length === 0) return [];
  const total = durationSec > 0 ? durationSec : 30;
  const slice = total / idxs.length;
  return idxs.map((idx, i) => ({
    idx,
    t_start: i * slice,
    t_end: (i + 1) * slice,
    is_hook_zone: i === 0,
    keyframe_uri: null,
  }));
}

/** One filmstrip cell per heatmap segment, graded by the energy at its midpoint. */
export function buildCells(
  segments: CraftSegment[],
  filmstrips: Record<number, string>,
  arc: EmotionArcPoint[],
  durationSec: number,
): CraftCell[] {
  if (segments.length === 0) return [];
  const total = durationSec > 0 ? durationSec : 1;
  return segments.map((seg) => {
    const midMs = ((seg.t_start + seg.t_end) / 2) * 1000;
    const widthPct =
      total > 0 ? ((seg.t_end - seg.t_start) / total) * 100 : 100 / segments.length;
    return {
      idx: seg.idx,
      url: filmstrips[seg.idx] ?? seg.keyframe_uri ?? null,
      intensity: intensityAt(arc, midMs),
      isHook: seg.is_hook_zone,
      widthPct,
    };
  });
}

// ── Editorial headline ────────────────────────────────────────────────────────

function bucket(score: number | null): 'strong' | 'mid' | 'weak' | null {
  if (score == null) return null;
  if (score >= VERDICT.STRONG) return 'strong';
  if (score >= VERDICT.MID) return 'mid';
  return 'weak';
}

/**
 * Three-clause editorial spine — open → middle → close — assembled from the
 * hook / pacing / cta verdict buckets. The weakest of the three reads in coral.
 * Mirrors the sketch's cadence: "Strong open, a fading middle, and no close."
 */
export function buildHeadline(pillars: CraftPillar[], ctaPresent: boolean): HeadlineClause[] {
  const byKey = (k: CraftPillarKey) => pillars.find((p) => p.key === k) ?? null;
  const hook = byKey('hook');
  const pacing = byKey('pacing');
  const cta = byKey('cta');

  const hookText =
    bucket(hook?.score ?? null) === 'strong'
      ? 'Strong open'
      : bucket(hook?.score ?? null) === 'mid'
        ? 'Steady open'
        : bucket(hook?.score ?? null) === 'weak'
          ? 'Soft open'
          : null;

  const pacingText =
    bucket(pacing?.score ?? null) === 'strong'
      ? 'steady throughout'
      : bucket(pacing?.score ?? null) === 'mid'
        ? 'a fading middle'
        : bucket(pacing?.score ?? null) === 'weak'
          ? 'a sagging middle'
          : null;

  const ctaText = !ctaPresent
    ? 'no close'
    : bucket(cta?.score ?? null) === 'weak'
      ? 'a soft close'
      : 'a clear close';

  // Determine which of the three present clauses is weakest → coral.
  const candidates = [
    { key: 'hook' as const, score: hook?.score ?? Infinity, has: hookText != null },
    { key: 'pacing' as const, score: pacing?.score ?? Infinity, has: pacingText != null },
    { key: 'cta' as const, score: ctaPresent ? (cta?.score ?? Infinity) : 0, has: true },
  ].filter((c) => c.has);
  let weakKey: CraftPillarKey | null = null;
  let weakScore = Infinity;
  for (const c of candidates) {
    if (c.score < weakScore) {
      weakScore = c.score;
      weakKey = c.key;
    }
  }

  const clauses: HeadlineClause[] = [];
  if (hookText) clauses.push({ text: hookText, weak: weakKey === 'hook' });
  if (pacingText) clauses.push({ text: pacingText, weak: weakKey === 'pacing' });
  clauses.push({ text: ctaText, weak: weakKey === 'cta' });
  return clauses;
}

/**
 * Audio-activity bars (0–1) for the band under the strip — the REAL emotion-arc
 * energy envelope (a proxy for on-screen activity / loudness), sampled across the
 * clip. Deterministic, no randomness.
 *
 * T4.6: the prior synthetic `sin(i*1.7)` "flutter" was dropped. It fabricated
 * waveform-like per-bar detail unrelated to any measured signal — the band read as
 * a real audio waveform when it was decoration over the energy arc. The bars now
 * reflect only the measured energy.
 */
export function buildWaveBars(arc: EmotionArcPoint[], durationSec: number, count = 64): number[] {
  const total = durationSec > 0 ? durationSec : 1;
  return Array.from({ length: count }, (_, i) => {
    const t = (i / Math.max(1, count - 1)) * total;
    const e = intensityAt(arc, t * 1000);
    return clamp01(0.28 + e * 0.6);
  });
}

/** First sentence of free text — fallback headline when no pillar data exists. */
export function firstSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : trimmed).trim();
}
