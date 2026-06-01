import type { Camera, GroupFrameLayout } from '../board-types';
import type { HookDecomposition, GeminiVideoSignals, GeminiAudioSignals, CtaSegmentResult } from '@/lib/engine/types';
import type { EmotionArcPoint } from '@/lib/engine/qwen/schemas';

export interface ContentAnalysisFrameProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

export type HookModality =
  | 'visual_stop_power'
  | 'audio_hook_quality'
  | 'text_overlay_score'
  | 'first_words_speech_score';

/** The four craft pillars rendered in the reading rail under the filmstrip. */
export type CraftPillarKey = 'hook' | 'pacing' | 'audio' | 'cta';

/** Heatmap segment slice the frame needs (subset of HeatmapPayload['segments'][n]). */
export interface CraftSegment {
  idx: number;
  t_start: number;
  t_end: number;
  is_hook_zone: boolean;
  keyframe_uri: string | null;
}

/**
 * Craft signals stashed by the analyze route into analysis_results.variants.craft
 * (no DB column). All fields nullable — degraded/text/slideshow runs omit them.
 */
export interface CraftSignals {
  video_signals: GeminiVideoSignals | null;
  cta_segment: CtaSegmentResult | null;
  audio_signals: GeminiAudioSignals | null;
  audio_perceptual_score: number | null;
  overall_impression: string | null;
  content_summary: string | null;
}

/** Normalized inputs the derive layer turns into the rendered instrument. */
export interface CraftInput {
  decomp: HookDecomposition | null;
  segments: CraftSegment[];
  emotionArc: EmotionArcPoint[];
  craft: CraftSignals;
  /** Merged keyframe URLs: segment idx → signed URL (stream + permalink). */
  filmstrips: Record<number, string>;
  /** Total video duration in seconds (from segments, fallback applied). */
  durationSec: number;
}

/** A single pillar in the reading rail. */
export interface CraftPillar {
  key: CraftPillarKey;
  label: string;
  /** Display value: a 0–10 numeral string, or a word ("None"). */
  value: string;
  /** Whether to render the "/10" denominator after the value. */
  showDenominator: boolean;
  /** One-line diagnostic caption under the numeral. */
  caption: string;
  /** Normalized 0–10 score used for weak-link selection. null = excluded. */
  score: number | null;
}

/** One filmstrip cell — a heatmap segment rendered as an energy-graded keyframe. */
export interface CraftCell {
  idx: number;
  url: string | null;
  /** 0–1 energy at the segment, drives the grade filter + fallback gradient. */
  intensity: number;
  isHook: boolean;
  widthPct: number;
}

/** A clause in the editorial headline; `weak` clauses render in coral. */
export interface HeadlineClause {
  text: string;
  weak: boolean;
}
