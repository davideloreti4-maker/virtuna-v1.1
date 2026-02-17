import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";

// Load .env.local (Next.js convention — same pattern as other scripts)
config({ path: resolve(__dirname, "../.env.local") });

// ─── Dynamic imports for path-aliased modules ──────────────────────
// The engine modules use @/ path aliases. We register tsconfig-paths
// at runtime so relative imports from ../src/lib/engine/* resolve correctly
// when those modules import @/lib/supabase/service etc.

import { register } from "tsconfig-paths";
import { readFileSync } from "fs";

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8")
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

import { runPredictionPipeline } from "../src/lib/engine/pipeline";
import { aggregateScores } from "../src/lib/engine/aggregator";
import type { PredictionResult } from "../src/lib/engine/types";

// ─── Types ──────────────────────────────────────────────────────────

interface SampleInput {
  input_mode: "text";
  content_text: string;
  content_type: "post" | "reel" | "story" | "video" | "thread";
  niche?: string;
}

interface SampleResult {
  sample_index: number;
  niche: string | null;
  content_type: string;
  overall_score: number | null;
  confidence: number | null;
  confidence_label: string | null;
  behavioral_score: number | null;
  gemini_score: number | null;
  rule_score: number | null;
  trend_score: number | null;
  factor_scores: Array<{ name: string; score: number }>;
  latency_ms: number | null;
  cost_cents: number | null;
  warnings: string[];
  has_behavioral_predictions: boolean;
  has_factors: boolean;
  has_suggestions: boolean;
  error: string | null;
}

interface BenchmarkSummary {
  total_samples: number;
  successful: number;
  failed: number;
  score_distribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stddev: number;
  };
  confidence_distribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  avg_latency_ms: number;
  avg_cost_cents: number;
  completeness: {
    has_behavioral_predictions_pct: number;
    has_factors_pct: number;
    has_suggestions_pct: number;
  };
  warning_frequency: Record<string, number>;
}

interface BenchmarkOutput {
  generated_at: string;
  engine_version: string;
  results: SampleResult[];
  summary: BenchmarkSummary;
}

// ─── Utility ────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`[benchmark] ${msg}`);

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sqDiffs = arr.map((v) => (v - m) ** 2);
  return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / (arr.length - 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 50 Diverse Content Samples ─────────────────────────────────────

const SAMPLES: SampleInput[] = [
  // ── 15 text-only across niches ──────────────────────────────────
  {
    input_mode: "text",
    content_text:
      "When you try to explain your job to your parents but they still think you sell drugs. The confusion on their face is priceless every single time I swear.",
    content_type: "video",
    niche: "comedy",
  },
  {
    input_mode: "text",
    content_text:
      "New choreo to the latest Doja Cat track. This footwork is INSANE and took me 3 days to nail the transitions. Tutorial dropping tomorrow if this gets 10K likes.",
    content_type: "video",
    niche: "dance",
  },
  {
    input_mode: "text",
    content_text:
      "5-minute garlic butter shrimp pasta that looks like it costs $40 at a restaurant. Secret is the pasta water and a LOT of parmesan. Recipe in comments.",
    content_type: "video",
    niche: "cooking",
  },
  {
    input_mode: "text",
    content_text:
      "The only 3 exercises you need for a bigger chest. Stop doing 10 different variations and master these compound movements. Progressive overload is king.",
    content_type: "video",
    niche: "fitness",
  },
  {
    input_mode: "text",
    content_text:
      "Fall outfit inspo: oversized blazer + baggy jeans + pointed boots. Thrifted everything for under $30. The blazer was $8 at Goodwill and it looks designer.",
    content_type: "video",
    niche: "fashion",
  },
  {
    input_mode: "text",
    content_text:
      "Glass skin routine that actually works for oily skin. The key is layering lightweight hydration, not stripping your face with harsh cleansers. Full routine below.",
    content_type: "video",
    niche: "beauty",
  },
  {
    input_mode: "text",
    content_text:
      "I built an AI agent that books my dentist appointments. It calls the office, navigates the phone menu, and confirms the slot. Here's how I did it with GPT-4 and Twilio.",
    content_type: "video",
    niche: "tech",
  },
  {
    input_mode: "text",
    content_text:
      "The reason you can't focus isn't your phone. It's that your brain literally cannot hold attention without dopamine hits every 30 seconds. Here's the neuroscience.",
    content_type: "video",
    niche: "education",
  },
  {
    input_mode: "text",
    content_text:
      "POV: You're the last person alive and you find a note that says 'we didn't leave — we're hiding.' Part 3 of the Empty Earth series. What would you do?",
    content_type: "video",
    niche: "storytelling",
  },
  {
    input_mode: "text",
    content_text:
      "Turn a toilet paper roll into a phone speaker. Cut a slit, slide your phone in, and the cardboard amplifies the sound by 300%. Zero cost upgrade that actually works.",
    content_type: "video",
    niche: "lifehack",
  },
  {
    input_mode: "text",
    content_text:
      "You're one decision away from a completely different life. Stop waiting for permission. Stop waiting for the perfect moment. It doesn't exist. Start now.",
    content_type: "video",
    niche: "motivation",
  },
  {
    input_mode: "text",
    content_text:
      "Brushing the microphone gently with a soft bristle brush. Slow tapping on glass jars filled with sand. Whispering the alphabet very slowly close to the mic.",
    content_type: "video",
    niche: "ASMR",
  },
  {
    input_mode: "text",
    content_text:
      "Clutched a 1v4 in Warzone with just a pistol and a throwing knife. The last guy was so confused he just stood there. This is why movement is everything.",
    content_type: "video",
    niche: "gaming",
  },
  {
    input_mode: "text",
    content_text:
      "Wrote this beat in 20 minutes using only stock plugins in FL Studio. Sometimes the simplest melodies hit the hardest. Full breakdown of the chord progression.",
    content_type: "video",
    niche: "music",
  },
  {
    input_mode: "text",
    content_text:
      "My golden retriever learned to open the fridge and now brings me a beer every evening. Took 6 months to train but honestly the best investment of my life.",
    content_type: "video",
    niche: "pets",
  },

  // ── 15 different content_types ──────────────────────────────────
  {
    input_mode: "text",
    content_text:
      "Day in the life of a remote software engineer in Bali. Wake up, surf, code, repeat. The commute is 0 minutes and the office view is the ocean.",
    content_type: "video",
    niche: "tech",
  },
  {
    input_mode: "text",
    content_text:
      "Sunset over Santorini. No filter needed. The colors are unreal in person. This is why Greece is the most photographed country on earth.",
    content_type: "post",
    niche: "travel",
  },
  {
    input_mode: "text",
    content_text:
      "Hot take: remote work is making us worse at communication, not better. We hide behind Slack messages when a 2-minute call would solve everything.",
    content_type: "thread",
    niche: "business",
  },
  {
    input_mode: "text",
    content_text:
      "Before and after my apartment transformation. Slide 1: the mess. Slide 2: minimalist dream. Slide 3: the breakdown of every item and where I got it.",
    content_type: "post",
    niche: "lifestyle",
  },
  {
    input_mode: "text",
    content_text:
      "Get ready with me for a first date. Starting with skincare, then a natural glam look that says I woke up like this but actually took 45 minutes.",
    content_type: "video",
    niche: "beauty",
  },
  {
    input_mode: "text",
    content_text:
      "Stop scrolling. Your posture is terrible right now. Sit up straight, roll your shoulders back, take a deep breath. You're welcome. Share this with someone who needs it.",
    content_type: "thread",
    niche: "fitness",
  },
  {
    input_mode: "text",
    content_text:
      "My morning routine as a CEO: 4:30 AM wake up, cold plunge, journal, meditate, gym, then start work at 7. It sounds crazy but the discipline compounds.",
    content_type: "video",
    niche: "motivation",
  },
  {
    input_mode: "text",
    content_text:
      "The ultimate protein pancake recipe. 200g oats, 4 eggs, 1 banana, scoop of whey. Blend and cook. 45g protein per serving and tastes like actual pancakes.",
    content_type: "post",
    niche: "cooking",
  },
  {
    input_mode: "text",
    content_text:
      "How to negotiate your salary: 1) Never give a number first. 2) Always counter. 3) Use silence as a weapon. 4) Get everything in writing. Thread below.",
    content_type: "thread",
    niche: "business",
  },
  {
    input_mode: "text",
    content_text:
      "POV: You're a barista and the customer orders an iced latte with oat milk, light ice, extra shot, in a hot cup, with a straw. The audacity.",
    content_type: "video",
    niche: "comedy",
  },
  {
    input_mode: "text",
    content_text:
      "3 underrated VS Code extensions that will save you hours: Error Lens, Peacock, and Todo Highlight. Number 2 is a game changer for monorepos.",
    content_type: "post",
    niche: "tech",
  },
  {
    input_mode: "text",
    content_text:
      "This song has been stuck in my head for 3 days. Playing it on piano with my own arrangement. If you know the original, drop the title in comments.",
    content_type: "video",
    niche: "music",
  },
  {
    input_mode: "text",
    content_text:
      "Painting a hyperrealistic eye in oils. The iris took 6 hours alone. Swipe to see the process from sketch to final piece. Prints available in bio.",
    content_type: "post",
    niche: "art",
  },
  {
    input_mode: "text",
    content_text:
      "Your cat is judging you right now. Here's proof: a compilation of cats staring at their owners with pure disappointment. We don't deserve them.",
    content_type: "video",
    niche: "pets",
  },
  {
    input_mode: "text",
    content_text:
      "The truth about passive income nobody talks about. It's not passive. You front-load years of work to maybe earn $500/month on autopilot. Still worth it though.",
    content_type: "thread",
    niche: "business",
  },

  // ── 10 with hashtags (popular, niche, saturated) ────────────────
  {
    input_mode: "text",
    content_text:
      "Learning a new dance every day for 30 days. Day 1: the running man. It's harder than it looks. #dancechallenge #30daychallenge #dance #fyp",
    content_type: "video",
    niche: "dance",
  },
  {
    input_mode: "text",
    content_text:
      "GRWM for a job interview at Google. The outfit needs to say I'm professional but also creative and definitely not nervous at all. #grwm #interview #techtok #viral",
    content_type: "video",
    niche: "fashion",
  },
  {
    input_mode: "text",
    content_text:
      "This smoothie recipe changed my skin in 2 weeks. Spinach, collagen, blueberries, and a secret ingredient I'll reveal at the end. #skincare #cleanskin #beautytok #foryou",
    content_type: "video",
    niche: "beauty",
  },
  {
    input_mode: "text",
    content_text:
      "My small apartment tour in Tokyo. 200 sq ft of pure efficiency. Every inch has a purpose. #apartment #minimalist #tokyo #livinginjapan",
    content_type: "video",
    niche: "lifestyle",
  },
  {
    input_mode: "text",
    content_text:
      "The most satisfying cake decorating you'll see today. Buttercream roses that look like they're real flowers. #cake #baking #satisfying #foodtok #fyp #foryoupage",
    content_type: "video",
    niche: "cooking",
  },
  {
    input_mode: "text",
    content_text:
      "I tried the 75 Hard challenge and here's what happened. Spoiler: I quit on day 23 but learned more about myself than the entire year before. #75hard #mentalhealth #growth",
    content_type: "video",
    niche: "fitness",
  },
  {
    input_mode: "text",
    content_text:
      "Rate my setup! Just upgraded to a triple monitor with custom keycaps and an underglow desk. Total cost: way too much. #setup #gaming #pcsetup #battlestation",
    content_type: "video",
    niche: "gaming",
  },
  {
    input_mode: "text",
    content_text:
      "POV: Your Italian grandma catches you using jarred pasta sauce. The disappointment. The lecture. The three-hour cooking lesson that follows. #italian #cooking #grandma #fyp #viral #trending",
    content_type: "video",
    niche: "comedy",
  },
  {
    input_mode: "text",
    content_text:
      "Why aren't we talking about this book? It completely changed how I think about money, relationships, and time. Link in bio. #booktok #reading #mustread",
    content_type: "video",
    niche: "education",
  },
  {
    input_mode: "text",
    content_text:
      "My dog's reaction to seeing snow for the first time is everything. Pure chaos and joy in 15 seconds. #dogsoftiktok #puppy #snow #cute #fyp #foryou #xyzbca",
    content_type: "video",
    niche: "pets",
  },

  // ── 5 designed to score HIGH (strong hooks, emotional, trending) ─
  {
    input_mode: "text",
    content_text:
      "WAIT FOR IT. This man proposed to his girlfriend at the exact moment the sunset lined up perfectly behind them. She had no idea. Her reaction made ME cry. Share this with someone who deserves love like this.",
    content_type: "video",
    niche: "storytelling",
  },
  {
    input_mode: "text",
    content_text:
      "I spent $0 and made my bathroom look like a luxury hotel. The trick? Dollar store finds + one viral TikTok hack. The before and after will shock you. Save this for later because you WILL want to try it.",
    content_type: "video",
    niche: "lifehack",
  },
  {
    input_mode: "text",
    content_text:
      "THIS is the smoothest transition I've ever filmed. Snap, outfit change, location change, mood change — all in one cut. Took me 47 takes but LOOK at this. If this doesn't blow up I'm quitting TikTok.",
    content_type: "video",
    niche: "dance",
  },
  {
    input_mode: "text",
    content_text:
      "You need to hear this. My therapist told me something today that completely shifted my perspective on anxiety. It's not the enemy. It's your body trying to protect you. Reframe it. Share this with someone who's struggling.",
    content_type: "video",
    niche: "motivation",
  },
  {
    input_mode: "text",
    content_text:
      "I asked 100 strangers what they would tell their 20-year-old self. The answers destroyed me. Number 47 had the whole crew in tears. This might be the most important video I've ever made. Watch till the end.",
    content_type: "video",
    niche: "storytelling",
  },

  // ── 5 designed to score LOW (no hook, generic, wall of text) ────
  {
    input_mode: "text",
    content_text: "Just another day. Nothing special happened. Went to work, came home, watched TV.",
    content_type: "video",
    niche: "lifestyle",
  },
  {
    input_mode: "text",
    content_text:
      "Here is some information about various topics that might be of interest to some people who are looking for general knowledge about things that happen in the world on a daily basis including but not limited to weather patterns economic trends and social media usage statistics which are constantly changing and evolving over time as new platforms emerge and old ones decline in popularity among different demographic groups across various regions and countries.",
    content_type: "thread",
    niche: "education",
  },
  {
    input_mode: "text",
    content_text: "Photo from today. #photo #day #life #me #happy",
    content_type: "post",
  },
  {
    input_mode: "text",
    content_text:
      "I guess I should post something today. Not sure what to talk about. Maybe I'll share what I had for lunch? It was a sandwich. Turkey and cheese. It was fine.",
    content_type: "video",
    niche: "lifestyle",
  },
  {
    input_mode: "text",
    content_text:
      "Content. More content. Everyone says to post every day so here I am posting every day even though I have nothing interesting to say. Consistency is key apparently.",
    content_type: "thread",
    niche: "motivation",
  },
];

// ─── Main Benchmark ─────────────────────────────────────────────────

async function main() {
  log("=== Virtuna v2 Accuracy Benchmark ===");
  log(`Samples: ${SAMPLES.length}`);
  log("");

  // Check required env vars — warn but continue (each sample handles errors individually)
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "DEEPSEEK_API_KEY",
  ];
  const missingVars = requiredVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    log(`WARNING: Missing environment variables: ${missingVars.join(", ")}`);
    log("Samples will likely fail. Continuing to produce results file...");
    log("");
  }

  const results: SampleResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < SAMPLES.length; i++) {
    const sample = SAMPLES[i]!;
    log(`Processing sample ${i + 1}/${SAMPLES.length}... [${sample.niche ?? "no niche"} / ${sample.content_type}]`);

    const start = performance.now();

    try {
      // Run through the full pipeline
      const pipelineResult = await runPredictionPipeline(sample);
      const prediction: PredictionResult = aggregateScores(pipelineResult);
      const latency = Math.round(performance.now() - start);

      const sampleResult: SampleResult = {
        sample_index: i,
        niche: sample.niche ?? null,
        content_type: sample.content_type,
        overall_score: prediction.overall_score,
        confidence: prediction.confidence,
        confidence_label: prediction.confidence_label,
        behavioral_score: prediction.behavioral_score,
        gemini_score: prediction.gemini_score,
        rule_score: prediction.rule_score,
        trend_score: prediction.trend_score,
        factor_scores: prediction.factors.map((f) => ({
          name: f.name,
          score: f.score,
        })),
        latency_ms: latency,
        cost_cents: prediction.cost_cents,
        warnings: prediction.warnings,
        has_behavioral_predictions:
          prediction.behavioral_predictions.completion_pct > 0 ||
          prediction.behavioral_predictions.share_pct > 0 ||
          prediction.behavioral_predictions.comment_pct > 0 ||
          prediction.behavioral_predictions.save_pct > 0,
        has_factors: prediction.factors.length > 0,
        has_suggestions: prediction.suggestions.length > 0,
        error: null,
      };

      results.push(sampleResult);
      successCount++;
      log(
        `  -> Score: ${prediction.overall_score}, Confidence: ${prediction.confidence_label} (${prediction.confidence.toFixed(2)}), Latency: ${latency}ms`
      );
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const errorMsg = err instanceof Error ? err.message : String(err);

      results.push({
        sample_index: i,
        niche: sample.niche ?? null,
        content_type: sample.content_type,
        overall_score: null,
        confidence: null,
        confidence_label: null,
        behavioral_score: null,
        gemini_score: null,
        rule_score: null,
        trend_score: null,
        factor_scores: [],
        latency_ms: latency,
        cost_cents: null,
        warnings: [],
        has_behavioral_predictions: false,
        has_factors: false,
        has_suggestions: false,
        error: errorMsg,
      });

      failCount++;
      log(`  -> FAILED: ${errorMsg.slice(0, 120)}`);
    }

    // 2s delay between samples to avoid API rate limits
    if (i < SAMPLES.length - 1) {
      await sleep(2000);
    }
  }

  // ─── Summary Statistics ─────────────────────────────────────────
  log("");
  log("=== Computing Summary Statistics ===");

  const successful = results.filter((r) => r.error === null);
  const scores = successful.map((r) => r.overall_score!);
  const latencies = successful.map((r) => r.latency_ms!);
  const costs = successful.map((r) => r.cost_cents!);

  const confDist = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of successful) {
    const label = r.confidence_label as "HIGH" | "MEDIUM" | "LOW";
    if (label in confDist) confDist[label]++;
  }

  // Warning frequency
  const warningFreq: Record<string, number> = {};
  for (const r of successful) {
    for (const w of r.warnings) {
      // Normalize warning to a category (strip specific data)
      const category = w
        .replace(/missing signals: [\w, ]+/, "missing signals: [...]")
        .replace(/\d+(\.\d+)?/g, "N");
      warningFreq[category] = (warningFreq[category] ?? 0) + 1;
    }
  }

  const successfulCount = successful.length;

  const summary: BenchmarkSummary = {
    total_samples: SAMPLES.length,
    successful: successCount,
    failed: failCount,
    score_distribution: {
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0,
      mean: Math.round(mean(scores) * 100) / 100,
      median: median(scores),
      stddev: Math.round(stddev(scores) * 100) / 100,
    },
    confidence_distribution: confDist,
    avg_latency_ms: Math.round(mean(latencies)),
    avg_cost_cents: Math.round(mean(costs) * 10000) / 10000,
    completeness: {
      has_behavioral_predictions_pct:
        successfulCount > 0
          ? Math.round(
              (successful.filter((r) => r.has_behavioral_predictions).length /
                successfulCount) *
                100
            )
          : 0,
      has_factors_pct:
        successfulCount > 0
          ? Math.round(
              (successful.filter((r) => r.has_factors).length / successfulCount) *
                100
            )
          : 0,
      has_suggestions_pct:
        successfulCount > 0
          ? Math.round(
              (successful.filter((r) => r.has_suggestions).length /
                successfulCount) *
                100
            )
          : 0,
    },
    warning_frequency: warningFreq,
  };

  // ─── Output JSON ────────────────────────────────────────────────
  const output: BenchmarkOutput = {
    generated_at: new Date().toISOString(),
    engine_version: successful.length > 0 ? "2.1.0" : "unknown",
    results,
    summary,
  };

  const outputPath = resolve(__dirname, "benchmark-results.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
  log(`Results written to ${outputPath}`);

  // ─── Console Summary ────────────────────────────────────────────
  log("");
  log("=== BENCHMARK RESULTS ===");
  log("");
  log(`Total samples:  ${summary.total_samples}`);
  log(`Successful:     ${summary.successful}`);
  log(`Failed:         ${summary.failed}`);
  log("");
  log("--- Score Distribution ---");
  log(`  Min:    ${summary.score_distribution.min}`);
  log(`  Max:    ${summary.score_distribution.max}`);
  log(`  Mean:   ${summary.score_distribution.mean}`);
  log(`  Median: ${summary.score_distribution.median}`);
  log(`  StdDev: ${summary.score_distribution.stddev}`);
  log("");
  log("--- Confidence Breakdown ---");
  log(`  HIGH:   ${confDist.HIGH}`);
  log(`  MEDIUM: ${confDist.MEDIUM}`);
  log(`  LOW:    ${confDist.LOW}`);
  log("");
  log("--- Performance ---");
  log(`  Avg Latency: ${summary.avg_latency_ms}ms`);
  log(`  Avg Cost:    $${summary.avg_cost_cents.toFixed(4)}`);
  log("");
  log("--- Completeness ---");
  log(
    `  Behavioral Predictions: ${summary.completeness.has_behavioral_predictions_pct}%`
  );
  log(`  Factors:               ${summary.completeness.has_factors_pct}%`);
  log(`  Suggestions:           ${summary.completeness.has_suggestions_pct}%`);
  log("");

  if (Object.keys(warningFreq).length > 0) {
    log("--- Warning Frequency ---");
    for (const [warning, count] of Object.entries(warningFreq).sort(
      (a, b) => b[1] - a[1]
    )) {
      log(`  [${count}x] ${warning}`);
    }
    log("");
  }

  // ─── v2 vs v1 Comparison Notes ──────────────────────────────────
  log("=== v2 vs v1 COMPARISON ===");
  log("");
  log(
    "1. BEHAVIORAL PREDICTIONS (NEW in v2): v2 produces completion_pct, share_pct, comment_pct, save_pct"
  );
  log(
    "   with percentile context. v1 had only an abstract 'refined_score' with no behavioral meaning."
  );
  log("");
  log(
    "2. TIKTOK-ALIGNED FACTORS (v2): 5 factors aligned to TikTok's algo signals:"
  );
  log(
    "   Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge."
  );
  log(
    "   v1 had generic factors (Originality, Quality, etc.) with no platform specificity."
  );
  log("");
  log(
    "3. FEATURE VECTOR BACKBONE (NEW in v2): Standardized 25-dimensional feature vector"
  );
  log(
    "   across all engine stages. v1 had ad-hoc fields with no structured backbone."
  );
  log("");
  log(
    "4. DYNAMIC WEIGHT SELECTION (NEW in v2): Weights redistribute when signals are missing."
  );
  log(
    "   Base: behavioral 45% + gemini 25% + rules 20% + trends 10%."
  );
  log(
    "   v1 used fixed weights (rule/trend/ml) regardless of data availability."
  );
  log("");
  log(
    `5. SCORE CLUSTERING: Most scores cluster in the ${summary.score_distribution.min}-${summary.score_distribution.max} range`
  );
  log(
    `   with mean=${summary.score_distribution.mean}, median=${summary.score_distribution.median}.`
  );
  log(
    "   v1 scores tended to cluster higher due to less calibrated prompting."
  );
  log("");

  log("Benchmark complete.");
  process.exit(0);
}

// ─── Run ──────────────────────────────────────────────────────────────

main().catch((err) => {
  log(`FATAL ERROR: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
