import type { Camera, GroupFrameLayout } from '../board-types';

export interface ContentAnalysisFrameProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

export type HookModality =
  | 'visual_stop_power'
  | 'audio_hook_quality'
  | 'text_overlay_score'
  | 'first_words_speech_score';
