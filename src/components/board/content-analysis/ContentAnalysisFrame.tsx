'use client';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { HookDecompNode } from './HookDecompNode';
import { EmotionArcNode } from './EmotionArcNode';
import type { ContentAnalysisFrameProps } from './content-analysis-types';

export function ContentAnalysisFrame({ camera: _camera, layout: _layout }: ContentAnalysisFrameProps) {
  const stream = useAnalysisStream();
  const phase = stream.phase;
  const result = stream.result ?? null;
  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  return (
    <div
      aria-busy={isStreaming}
      className="flex flex-row gap-4 p-2 h-full"
      data-testid="content-analysis-frame"
    >
      <HookDecompNode
        decomp={result?.hook_decomposition ?? null}
        segments={result?.heatmap?.segments ?? null}
        counterfactuals={result?.counterfactuals?.suggestions}
        className="w-[480px] shrink-0"
      />
      <EmotionArcNode
        points={result?.emotion_arc ?? null}
        className="flex-1"
      />
    </div>
  );
}
