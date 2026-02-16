import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores } from "@/lib/engine/aggregator";
import { AnalysisInputSchema } from "@/lib/engine/types";

export const maxDuration = 120; // API-10: Vercel Pro plan

/**
 * POST /api/analyze
 *
 * Accepts content + type + society, runs prediction engine,
 * streams progress via SSE, returns PredictionResult.
 *
 * v2: Uses runPredictionPipeline() + aggregateScores() pattern
 * instead of direct engine module calls.
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // SSE stream setup
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          const validated = AnalysisInputSchema.parse(body);
          const service = createServiceClient();

          // Phase 1: Run full pipeline (handles Wave 1 + Wave 2 internally)
          send("phase", {
            phase: "analyzing",
            message:
              "Analyzing content with Gemini and loading creator context...",
          });
          const pipelineResult = await runPredictionPipeline(validated);

          // Phase 2: Aggregate scores
          send("phase", {
            phase: "scoring",
            message: "Calculating predictions and assembling results...",
          });
          const result = aggregateScores(pipelineResult);

          // Persist to DB with v2 columns
          await service.from("analysis_results").insert({
            user_id: user.id,
            content_text: validated.content_text ?? "",
            content_type: validated.content_type,
            society_id: validated.society_id ?? null,
            overall_score: result.overall_score,
            confidence: result.confidence, // Now numeric 0-1 (was categorical string)
            factors: result.factors as unknown as null,
            suggestions: result.suggestions as unknown as null,
            rule_score: result.rule_score,
            trend_score: result.trend_score,
            score_weights: result.score_weights as unknown as null,
            latency_ms: result.latency_ms,
            cost_cents: result.cost_cents,
            engine_version: result.engine_version,
            gemini_model: result.gemini_model,
            deepseek_model: result.deepseek_model,
            // v2 columns (from Phase 4 migration)
            behavioral_predictions:
              result.behavioral_predictions as unknown as null,
            feature_vector: result.feature_vector as unknown as null,
            reasoning: result.reasoning,
            warnings: result.warnings,
            input_mode: result.input_mode,
            has_video: result.has_video,
            gemini_score: result.gemini_score,
          });

          // Track usage
          const today = new Date().toISOString().split("T")[0]!;
          await service.from("usage_tracking").upsert(
            {
              user_id: user.id,
              period_start: today,
              period_type: "daily",
              analysis_count: 1,
            },
            { onConflict: "user_id,period_start,period_type" }
          );

          send("complete", result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Pipeline failed";
          send("error", { error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[analyze] Request error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
