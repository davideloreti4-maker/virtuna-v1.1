"use client";

/**
 * ResultCard — client wrapper for /analyze/[id] result surface.
 *
 * Architecture (D-11):
 *  - Receives analysisId + initialData from the server page (SSR fast path)
 *  - When initialData.overall_score != null → Pitfall #3 short-circuit → all panels render 'ready'
 *  - When initialData=null or overall_score=null → opens stream via useAnalysisStream
 *  - Iterates PANEL_IDS, renders a GlassPanel per id gated by panelReady[id]
 *  - data-panel-id + data-panel-ready attributes are the E2E hook contract (D-11)
 *
 * B3 wiring proofs (two panels render REAL values, not placeholders):
 *  - optimal_post panel: renders JSON.stringify(result.optimal_post_window) when ready
 *  - emotion_arc panel: renders first/last data point summary when ready
 *  All other 8 panels render placeholder copy — to be replaced in Phase 3-5.
 *
 * XSS: All P1 placeholder content is static strings. P3-P5 panel implementations
 * MUST use React's default JSX escaping for any dynamic field (factors[].rationale,
 * reasoning narrative, persona reasoning). NEVER use dangerouslySetInnerHTML.
 * See T-01-RC-XSS in threat model.
 */

import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { PANEL_IDS, type PanelId } from "@/lib/engine/panel-mapping";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { PanelSkeleton } from "./result-card-skeleton";

// Permissive row shape — accepts both Supabase DB rows (Json fields) and
// completed PredictionResult shapes. The hook's AnalysisStreamInitialData
// type handles the exact structural requirements.
type AnalysisResultRow = Record<string, unknown> & { overall_score?: number | null };

interface ResultCardProps {
  analysisId: string;
  initialData: AnalysisResultRow | null;
}

// Human-readable labels for each panel slot.
// Local to ResultCard so P3-P5 panel implementations can override
// per-panel labels independently without touching this contract.
const PANEL_LABEL: Record<PanelId, string> = {
  verdict: "Verdict",
  retention: "Retention curve",
  persona_breakdown: "Personas",
  hook_decomp: "Hook decomposition",
  similar_videos: "Similar videos",
  reasoning: "Reasoning",
  emotion_arc: "Emotion arc",
  comparative_baseline: "Comparative baseline",
  optimal_post: "When to post",
  anti_virality: "Anti-virality",
  insight_hero: "Apollo insight",  // D-08 hero (Plan 05-03)
};

export function ResultCard({ analysisId, initialData }: ResultCardProps) {
  const { panelReady, phase, result, error, reconnect } = useAnalysisStream({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData: initialData ? ({ id: analysisId, ...initialData } as any) : null,
  });

  return (
    <div className="space-y-4">
      {/* Stream phase indicator — used by E2E tests as data-stream-phase hook */}
      <p
        data-stream-phase={phase}
        className="text-xs text-muted-foreground"
      >
        Phase: {phase}
        {result?.overall_score != null && (
          <span className="ml-2 font-medium text-foreground">
            {Math.round(result.overall_score * 100)}% score
          </span>
        )}
      </p>

      {/* Panel grid — 10 slots, each gated by panelReady */}
      <div className="grid gap-4 md:grid-cols-2">
        {PANEL_IDS.map((id) => (
          // Outer div carries the data-* attributes for E2E hooks (D-11).
          // GlassPanel does not forward data-* props (4-prop zero-config interface),
          // so the wrapper div owns the hook contract.
          <div
            key={id}
            data-panel-id={id}
            data-panel-ready={panelReady[id]}
          >
          <GlassPanel
            className="p-4 min-h-[120px]"
          >
            <h3 className="mb-2 text-sm font-medium text-foreground">
              {PANEL_LABEL[id]}
            </h3>

            {panelReady[id] === "ready" ? (
              // B3: Two panels render real values from the result
              id === "optimal_post" && result?.optimal_post_window != null ? (
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(result.optimal_post_window, null, 2)}
                </pre>
              ) : id === "emotion_arc" &&
                Array.isArray(result?.emotion_arc) &&
                (result.emotion_arc as Array<{ timestamp_ms: number; intensity_0_1: number }>).length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  {(() => {
                    const arc = result.emotion_arc as Array<{ timestamp_ms: number; intensity_0_1: number }>;
                    const first = arc[0]!;
                    const last = arc[arc.length - 1]!;
                    return `First: t=${first.timestamp_ms}ms i=${first.intensity_0_1.toFixed(2)} · Last: t=${last.timestamp_ms}ms i=${last.intensity_0_1.toFixed(2)}`;
                  })()}
                </div>
              ) : (
                // Placeholder copy for all other 8 panels (verdict, retention,
                // persona_breakdown, hook_decomp, similar_videos, reasoning,
                // comparative_baseline, anti_virality) — replaced in Phase 3-5.
                <p className="text-xs text-muted">
                  Panel content placeholder — implemented in Phase 3-5
                </p>
              )
            ) : (
              <PanelSkeleton ready={panelReady[id]} />
            )}
          </GlassPanel>
          </div>
        ))}
      </div>

      {/* Error region — shown when stream encounters a terminal error */}
      {phase === "error" && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          <p className="mb-2">
            {error ?? "An error occurred during analysis."}
          </p>
          <button
            onClick={reconnect}
            className="rounded-md border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.08] transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
