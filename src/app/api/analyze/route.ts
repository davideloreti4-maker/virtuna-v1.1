import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { AnalysisInputSchema } from "@/lib/engine/types";

export const maxDuration = 120; // API-10: Vercel Pro plan

/**
 * POST /api/analyze
 *
 * Accepts content + type + society, runs prediction engine,
 * streams progress via SSE, returns PredictionResult.
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

    // Validate input
    const parseResult = AnalysisInputSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

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
          send("phase", { phase: "analyzing", message: "Analyzing content..." });

          send("phase", { phase: "matching", message: "Matching rules and trends..." });

          send("phase", { phase: "simulating", message: "Simulating audience reactions..." });

          send("phase", { phase: "generating", message: "Generating predictions..." });

          // Run the prediction pipeline
          const result = await runPredictionPipeline(input);

          // Save to database
          const service = createServiceClient();
          await service.from("analysis_results").insert({
            user_id: user.id,
            content_text: input.content_text,
            content_type: input.content_type,
            society_id: input.society_id ?? null,
            overall_score: result.overall_score,
            confidence: result.confidence === "HIGH" ? 0.9 : result.confidence === "MEDIUM" ? 0.6 : 0.3,
            factors: result.factors as unknown as null,
            suggestions: result.suggestions as unknown as null,
            personas: result.persona_reactions as unknown as null,
            variants: result.variants as unknown as null,
            conversation_themes: result.conversation_themes as unknown as null,
            rule_score: result.rule_score,
            trend_score: result.trend_score,
            ml_score: result.ml_score,
            score_weights: result.score_weights as unknown as null,
            latency_ms: result.latency_ms,
            cost_cents: result.cost_cents,
            engine_version: result.engine_version,
            gemini_model: result.gemini_model,
            deepseek_model: result.deepseek_model,
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
