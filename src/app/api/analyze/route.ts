import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores } from "@/lib/engine/aggregator";
import { AnalysisInputSchema } from "@/lib/engine/types";

export const maxDuration = 120; // API-10: Vercel Pro plan

// INFRA-01: Rate limits by subscription tier (daily analysis count)
const DAILY_LIMITS: Record<string, number> = {
  free: 5,
  starter: 50,
  pro: Infinity, // unlimited
};

/**
 * POST /api/analyze
 *
 * Accepts content + type + society, runs prediction engine,
 * streams progress via SSE, returns PredictionResult.
 *
 * v2: Uses runPredictionPipeline() + aggregateScores() pattern
 * instead of direct engine module calls.
 *
 * INFRA-01: Rate limiting by subscription tier
 * INFRA-04: Input validation (TikTok URL, content length, video path)
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

    // -------------------------------------------------------
    // INFRA-04: Input validation (before Zod parse for better error messages)
    // -------------------------------------------------------

    // Content text basic validation
    if (body.content_text && typeof body.content_text === "string") {
      const trimmed = body.content_text.trim();

      // Max length
      if (body.content_text.length > 10000) {
        return Response.json(
          { error: "Content text exceeds maximum length of 10,000 characters" },
          { status: 400 }
        );
      }

      // Min length (also rejects whitespace-only since trim reduces those to "")
      if (trimmed.length < 10) {
        return Response.json(
          { error: "Content text must be at least 10 characters after trimming" },
          { status: 400 }
        );
      }

      // Anti-spam: reject >90% repeated characters
      const charCounts = new Map<string, number>();
      for (const ch of trimmed) {
        charCounts.set(ch, (charCounts.get(ch) ?? 0) + 1);
      }
      const maxCharCount = Math.max(...charCounts.values());
      if (maxCharCount / trimmed.length > 0.9) {
        return Response.json(
          { error: "Content appears to be spam (excessive repeated characters)" },
          { status: 400 }
        );
      }
    }

    // TikTok URL format validation
    if (body.input_mode === "tiktok_url" && body.tiktok_url) {
      const tiktokPattern = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//;
      if (!tiktokPattern.test(body.tiktok_url)) {
        return Response.json(
          { error: "Invalid TikTok URL. Must be a tiktok.com link." },
          { status: 400 }
        );
      }
    }

    // Video storage path validation
    if (body.input_mode === "video_upload" && body.video_storage_path) {
      if (
        typeof body.video_storage_path !== "string" ||
        body.video_storage_path.length === 0
      ) {
        return Response.json(
          { error: "Invalid video storage path" },
          { status: 400 }
        );
      }
    }

    // -------------------------------------------------------
    // INFRA-01: Rate limiting by subscription tier
    // -------------------------------------------------------

    // Service client created before stream — used for rate limit check AND inside stream
    const service = createServiceClient();

    // Query user's subscription tier
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("virtuna_tier")
      .eq("user_id", user.id)
      .single();
    const tier = (subscription?.virtuna_tier as string) || "free";

    // Query today's usage count
    const today = new Date().toISOString().split("T")[0]!;
    const { data: usage } = await service
      .from("usage_tracking")
      .select("analysis_count")
      .eq("user_id", user.id)
      .eq("period_start", today)
      .eq("period_type", "daily")
      .single();
    const currentCount = usage?.analysis_count ?? 0;

    // Check against limit
    const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.free!;
    if (currentCount >= limit) {
      return Response.json(
        {
          error: "Daily analysis limit reached",
          limit,
          tier,
          reset: "midnight UTC",
        },
        { status: 429 }
      );
    }

    // -------------------------------------------------------
    // SSE stream setup
    // -------------------------------------------------------
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

          // Build rule_contributions JSONB for per-rule tracking (RULE-03)
          const ruleContributions = pipelineResult.ruleResult.matched_rules.map(r => ({
            rule_id: r.rule_id,
            rule_name: r.rule_name,
            score: r.score,
            max_score: r.max_score,
            tier: r.tier,
          }));

          // Prepend pipeline warnings (partial failures) before DeepSeek warnings
          const finalResult = {
            ...result,
            warnings: [...pipelineResult.warnings, ...result.warnings],
          };

          // Persist to DB with v2 columns
          await service.from("analysis_results").insert({
            user_id: user.id,
            content_text: validated.content_text ?? "",
            content_type: validated.content_type,
            society_id: validated.society_id ?? null,
            overall_score: finalResult.overall_score,
            confidence: finalResult.confidence,
            factors: finalResult.factors as unknown as null,
            suggestions: finalResult.suggestions as unknown as null,
            rule_score: finalResult.rule_score,
            trend_score: finalResult.trend_score,
            score_weights: finalResult.score_weights as unknown as null,
            latency_ms: finalResult.latency_ms,
            cost_cents: finalResult.cost_cents,
            engine_version: finalResult.engine_version,
            gemini_model: finalResult.gemini_model,
            deepseek_model: finalResult.deepseek_model,
            // v2 columns (from Phase 4 migration)
            behavioral_predictions:
              finalResult.behavioral_predictions as unknown as null,
            feature_vector: finalResult.feature_vector as unknown as null,
            reasoning: finalResult.reasoning,
            warnings: finalResult.warnings,
            input_mode: finalResult.input_mode,
            has_video: finalResult.has_video,
            gemini_score: finalResult.gemini_score,
            // RULE-03: Per-rule contribution tracking for accuracy computation
            rule_contributions: ruleContributions as unknown as null,
          });

          // Track usage (increments AFTER successful analysis)
          await service.from("usage_tracking").upsert(
            {
              user_id: user.id,
              period_start: today,
              period_type: "daily",
              analysis_count: currentCount + 1,
            },
            { onConflict: "user_id,period_start,period_type" }
          );

          send("complete", finalResult);
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
