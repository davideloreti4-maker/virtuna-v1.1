'use client';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { HookDecompNode } from './HookDecompNode';
import { EmotionArcNode } from './EmotionArcNode';
import type { ContentAnalysisFrameProps } from './content-analysis-types';

export function ContentAnalysisFrame({ camera: _camera, layout: _layout }: ContentAnalysisFrameProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const phase = stream.phase;
  const result = stream.result ?? null;
  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  return (
    <div
      aria-busy={isStreaming}
      // items-start + overflow-y-auto: the columns size to their natural height
      // and the frame scrolls if content exceeds it, instead of the fixed-height
      // GroupFrameOverlay silently clipping the coherence / cognitive-load chips
      // below the hook bars.
      // flex-col on phones (card view) → the two columns stack and fill width
      // instead of the 480px hook column overflowing; flex-row from sm: up keeps
      // the desktop canvas layout unchanged (that frame is always ≥640px wide).
      className="flex flex-col sm:flex-row items-start gap-4 p-2 h-full overflow-y-auto"
      data-testid="content-analysis-frame"
    >
      <HookDecompNode
        decomp={result?.hook_decomposition ?? null}
        segments={result?.heatmap?.segments ?? null}
        counterfactuals={result?.counterfactuals?.suggestions}
        className="w-full sm:w-[480px] sm:shrink-0"
      />
      <EmotionArcNode
        points={result?.emotion_arc ?? null}
        className="flex-1"
      />
    </div>
  );
}
