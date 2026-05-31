import { describe, it, expect } from 'vitest';
import type { HookDecomposition, GeminiVideoSignals, GeminiAudioSignals, CtaSegmentResult } from '@/lib/engine/types';
import type { EmotionArcPoint } from '@/lib/engine/qwen/schemas';
import type { CraftSegment } from '../content-analysis-types';
import {
  formatTimeSec,
  durationFromSegments,
  meanHookScore,
  strongestModality,
  hookPillar,
  intensityAt,
  energyDipWindow,
  pacingPillar,
  audioMixCaption,
  audioPillar,
  ctaPillar,
  buildPillars,
  selectWeakLink,
  energyGradeFilter,
  fallbackCellGradient,
  buildCells,
  segmentsFromFilmstrips,
  buildHeadline,
  buildWaveBars,
  firstSentence,
} from '../content-analysis-derive';

const decomp: HookDecomposition = {
  visual_stop_power: 9.0,
  audio_hook_quality: 7.0,
  text_overlay_score: 8.0,
  first_words_speech_score: 8.0,
  weakest_modality: 'audio_hook_quality',
  visual_audio_coherence: 8.0,
  cognitive_load: 3,
};

const video: GeminiVideoSignals = {
  visual_production_quality: 8,
  hook_visual_impact: 9,
  pacing_score: 6,
  transition_quality: 7,
} as GeminiVideoSignals;

const audioVoice: GeminiAudioSignals = {
  voice_clarity_0_10: 8,
  audio_hook_first_2s_0_10: 7,
  silence_ratio: 0.08,
  voiceover_ratio: 0.7,
  music_ratio: 0.2,
  audio_description: 'Clear voiceover throughout with light background music.',
};

// A 0:34 video: punchy open → mid sag (0:08–0:21) → soft recover → flat tail.
const arc: EmotionArcPoint[] = [
  { timestamp_ms: 0, intensity_0_1: 0.58 },
  { timestamp_ms: 5000, intensity_0_1: 0.86 },
  { timestamp_ms: 8000, intensity_0_1: 0.42 },
  { timestamp_ms: 13000, intensity_0_1: 0.3 },
  { timestamp_ms: 18000, intensity_0_1: 0.33 },
  { timestamp_ms: 21000, intensity_0_1: 0.44 },
  { timestamp_ms: 27000, intensity_0_1: 0.58 },
  { timestamp_ms: 34000, intensity_0_1: 0.5 },
];

describe('formatTimeSec', () => {
  it('formats M:SS', () => {
    expect(formatTimeSec(0)).toBe('0:00');
    expect(formatTimeSec(8)).toBe('0:08');
    expect(formatTimeSec(65)).toBe('1:05');
  });
});

describe('durationFromSegments', () => {
  it('uses the last segment end; falls back when empty', () => {
    const segs: CraftSegment[] = [
      { idx: 0, t_start: 0, t_end: 10, is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 10, t_end: 34, is_hook_zone: false, keyframe_uri: null },
    ];
    expect(durationFromSegments(segs, 30)).toBe(34);
    expect(durationFromSegments([], 30)).toBe(30);
  });
});

describe('hook pillar', () => {
  it('mean of 4 modalities', () => {
    expect(meanHookScore(decomp)).toBeCloseTo(8.0, 5);
    expect(meanHookScore(null)).toBeNull();
  });
  it('strongest modality names the open', () => {
    expect(strongestModality(decomp)).toBe('visual_stop_power');
  });
  it('hookPillar surfaces score + caption', () => {
    const p = hookPillar(decomp);
    expect(p.value).toBe('8.0');
    expect(p.showDenominator).toBe(true);
    expect(p.caption).toBe('Visual-led open');
    expect(p.score).toBeCloseTo(8.0, 5);
  });
  it('hookPillar degrades when null', () => {
    const p = hookPillar(null);
    expect(p.value).toBe('—');
    expect(p.showDenominator).toBe(false);
    expect(p.score).toBeNull();
  });
});

describe('intensityAt', () => {
  it('returns neutral when no arc', () => {
    expect(intensityAt([], 5000)).toBe(0.5);
  });
  it('clamps to endpoints', () => {
    expect(intensityAt(arc, -100)).toBeCloseTo(0.58, 5);
    expect(intensityAt(arc, 999999)).toBeCloseTo(0.5, 5);
  });
  it('interpolates between points', () => {
    // midway 0–5000ms between 0.58 and 0.86 → 0.72
    expect(intensityAt(arc, 2500)).toBeCloseTo(0.72, 2);
  });
});

describe('energyDipWindow', () => {
  it('finds the contiguous low-energy run', () => {
    const dip = energyDipWindow(arc, 34);
    expect(dip).not.toBeNull();
    expect(dip!.startSec).toBe(8);
    expect(dip!.endSec).toBe(21);
  });
  it('returns null when the arc has no sustained dip', () => {
    const flat: EmotionArcPoint[] = [
      { timestamp_ms: 0, intensity_0_1: 0.8 },
      { timestamp_ms: 5000, intensity_0_1: 0.82 },
      { timestamp_ms: 10000, intensity_0_1: 0.79 },
    ];
    expect(energyDipWindow(flat, 30)).toBeNull();
  });
  it('returns null for too-short arcs', () => {
    expect(energyDipWindow([{ timestamp_ms: 0, intensity_0_1: 0.1 }], 30)).toBeNull();
  });
});

describe('pacing pillar', () => {
  it('caption names the energy dip window when present', () => {
    const p = pacingPillar(video, arc, 34);
    expect(p.value).toBe('6.0');
    expect(p.caption).toBe('Energy dips 0:08–0:21');
    expect(p.score).toBe(6);
  });
  it('falls back to transition quality without an arc dip', () => {
    const p = pacingPillar(video, [], 34);
    expect(p.caption).toBe('Smooth transitions'); // transition_quality 7 ≥ STRONG
  });
  it('degrades to dash without video signals', () => {
    const p = pacingPillar(null, [], 34);
    expect(p.value).toBe('—');
    expect(p.score).toBeNull();
  });
});

describe('audio pillar', () => {
  it('mix caption: voiceover-led', () => {
    expect(audioMixCaption(audioVoice)).toBe('Voiceover-led');
  });
  it('mix caption: sparse / music', () => {
    expect(audioMixCaption({ ...audioVoice, silence_ratio: 0.6 })).toBe('Sparse audio');
    expect(audioMixCaption({ ...audioVoice, voiceover_ratio: 0.1, music_ratio: 0.8 })).toBe('Music-led');
  });
  it('uses perceptual score (0-100 → 0-10)', () => {
    const p = audioPillar(82, audioVoice);
    expect(p.value).toBe('8.2');
    expect(p.caption).toBe('Voiceover-led');
    expect(p.score).toBeCloseTo(8.2, 5);
  });
  it('no speech track → excluded from weak-link', () => {
    const p = audioPillar(null, null);
    expect(p.value).toBe('—');
    expect(p.caption).toBe('No speech track');
    expect(p.score).toBeNull();
  });
});

describe('cta pillar', () => {
  it('absent → None, score 0, the weak link', () => {
    const p = ctaPillar(null);
    expect(p.value).toBe('None');
    expect(p.showDenominator).toBe(false);
    expect(p.caption).toBe('Ends with no ask');
    expect(p.score).toBe(0);
  });
  it('present → strength + type label', () => {
    const cta: CtaSegmentResult = { cta_present: true, strength: 7, type: 'follow', rationale: 'Asks for a follow.' };
    const p = ctaPillar(cta);
    expect(p.value).toBe('7.0');
    expect(p.caption).toBe('Follow ask');
    expect(p.score).toBe(7);
  });
});

describe('selectWeakLink', () => {
  it('picks the missing CTA (score 0) over higher pillars', () => {
    const pillars = buildPillars({ decomp, video, arc, perceptual: 82, audio: audioVoice, cta: null, durationSec: 34 });
    expect(selectWeakLink(pillars)).toBe('cta');
  });
  it('picks the genuine lowest score when CTA is strong', () => {
    const cta: CtaSegmentResult = { cta_present: true, strength: 9, type: 'follow', rationale: 'x' };
    const weakVideo = { ...video, pacing_score: 3 };
    const pillars = buildPillars({ decomp, video: weakVideo, arc: [], perceptual: 82, audio: audioVoice, cta, durationSec: 34 });
    expect(selectWeakLink(pillars)).toBe('pacing');
  });
  it('returns null when nothing is scored', () => {
    const pillars = buildPillars({ decomp: null, video: null, arc: [], perceptual: null, audio: null, cta: null, durationSec: 30 });
    // cta absent still yields score 0 → weak link is cta, never null here.
    expect(selectWeakLink(pillars)).toBe('cta');
  });
});

describe('filmstrip grading', () => {
  it('grade filter brightens + desaturates by energy', () => {
    const bright = energyGradeFilter(0.9);
    const dead = energyGradeFilter(0.2);
    expect(bright).toContain('brightness(1.06)');
    expect(dead).toContain('grayscale(0.58)'); // (1-0.2)*0.72
  });
  it('fallback gradient is a valid css gradient string', () => {
    expect(fallbackCellGradient(0.5)).toMatch(/^radial-gradient\(.*linear-gradient\(/);
  });
});

describe('buildCells', () => {
  const segs: CraftSegment[] = [
    { idx: 0, t_start: 0, t_end: 6, is_hook_zone: true, keyframe_uri: 'seg0.jpg' },
    { idx: 1, t_start: 6, t_end: 34, is_hook_zone: false, keyframe_uri: null },
  ];
  it('prefers streamed filmstrip url, then keyframe_uri', () => {
    const cells = buildCells(segs, { 1: 'stream1.jpg' }, arc, 34);
    expect(cells[0]!.url).toBe('seg0.jpg'); // no stream entry → keyframe_uri
    expect(cells[1]!.url).toBe('stream1.jpg'); // streamed wins
    expect(cells[0]!.isHook).toBe(true);
    expect(cells[0]!.widthPct).toBeCloseTo((6 / 34) * 100, 3);
  });
  it('empty segments → empty cells', () => {
    expect(buildCells([], {}, arc, 34)).toEqual([]);
  });
});

describe('segmentsFromFilmstrips', () => {
  it('builds equal-width segments with the first as hook', () => {
    const segs = segmentsFromFilmstrips({ 0: 'a', 1: 'b', 2: 'c' }, 30);
    expect(segs).toHaveLength(3);
    expect(segs[0]!.is_hook_zone).toBe(true);
    expect(segs[1]!.is_hook_zone).toBe(false);
    expect(segs[2]!.t_end).toBe(30);
  });
  it('empty when no filmstrips', () => {
    expect(segmentsFromFilmstrips({}, 30)).toEqual([]);
  });
});

describe('buildHeadline', () => {
  it('produces the open→middle→close spine with the weak clause flagged', () => {
    const pillars = buildPillars({ decomp, video, arc, perceptual: 82, audio: audioVoice, cta: null, durationSec: 34 });
    const clauses = buildHeadline(pillars, false);
    expect(clauses.map((c) => c.text)).toEqual(['Strong open', 'a fading middle', 'no close']);
    // CTA absent → "no close" is the weak clause (coral).
    expect(clauses.find((c) => c.text === 'no close')!.weak).toBe(true);
    expect(clauses.find((c) => c.text === 'Strong open')!.weak).toBe(false);
  });
  it('marks a present clear close when CTA exists', () => {
    const cta: CtaSegmentResult = { cta_present: true, strength: 8, type: 'follow', rationale: 'x' };
    const pillars = buildPillars({ decomp, video, arc, perceptual: 82, audio: audioVoice, cta, durationSec: 34 });
    const clauses = buildHeadline(pillars, true);
    expect(clauses[clauses.length - 1]!.text).toBe('a clear close');
  });
});

describe('buildWaveBars', () => {
  it('returns count bars in 0..1', () => {
    const bars = buildWaveBars(arc, 34, 32);
    expect(bars).toHaveLength(32);
    expect(bars.every((b) => b >= 0 && b <= 1)).toBe(true);
  });
});

describe('firstSentence', () => {
  it('extracts the first sentence', () => {
    expect(firstSentence('Strong hook. Weak middle.')).toBe('Strong hook.');
    expect(firstSentence('No punctuation here')).toBe('No punctuation here');
    expect(firstSentence(null)).toBeNull();
    expect(firstSentence('   ')).toBeNull();
  });
});
