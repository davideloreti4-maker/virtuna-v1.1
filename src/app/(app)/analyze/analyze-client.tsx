"use client";

/**
 * /analyze — client wrapper.
 *
 * Wires ContentForm → useAnalysisStream.start() → router.push(/analyze/[id]).
 *
 * ContentForm calls onSubmit(data: ContentFormData) after validation.
 * We map ContentFormData → AnalysisStreamInput and call stream.start().
 * Once the `event: started` frame sets analysisId and phase shifts to
 * "analyzing", the useEffect navigates to /analyze/[id].
 *
 * Pitfall #6 mitigation: the POST /api/analyze route inserts a placeholder
 * row before emitting event:started, so the destination server page's DB
 * read should find the row immediately.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ContentForm, type ContentFormData } from "@/components/app/content-form";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";

export function AnalyzeClient() {
  const router = useRouter();
  const stream = useAnalysisStream();

  // Navigate to /analyze/[id] as soon as analysisId is set and stream is live.
  useEffect(() => {
    if (stream.analysisId && stream.phase === "analyzing") {
      router.push(`/analyze/${stream.analysisId}`);
    }
  }, [stream.analysisId, stream.phase, router]);

  const handleSubmit = (data: ContentFormData) => {
    const input = {
      input_mode: data.input_mode,
      content_type: data.input_mode === "tiktok_url" ? "tiktok_url" : "text",
      ...(data.input_mode === "text" && { content_text: data.caption }),
      ...(data.input_mode === "tiktok_url" && { tiktok_url: data.tiktok_url }),
      ...(data.input_mode === "video_upload" && {
        content_text: data.video_caption,
      }),
      ...(data.niche && { niche: data.niche }),
    };

    // fire-and-forget — useEffect watches for analysisId + phase transition
    stream.start(input).catch(() => {
      // Error handled by stream.phase === "error" below
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analyze your content</h1>
        <p className="text-sm text-muted-foreground">
          Submit a TikTok URL, caption, or video file to get a prediction score.
        </p>
      </div>

      <ContentForm onSubmit={handleSubmit} />

      {stream.phase === "error" && stream.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {stream.error}
        </p>
      )}
    </div>
  );
}
