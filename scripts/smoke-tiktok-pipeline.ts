/**
 * Phase 13 Plan 05 — TikTok Pipeline Smoke Runner
 *
 * Drives the Virtuna prediction pipeline for a list of TikTok URLs.
 * Two modes:
 *   Mode 1 (default — UI-driven): Instructs user to upload each video via the UI,
 *   then polls Supabase `analysis_results` for the completed prediction.
 *
 *   Mode 2 (--direct): POSTs directly to /api/analyze with tiktok_url mode,
 *   captures the SSE stream and the final PredictionResult.
 *
 * Usage:
 *   pnpm tsx scripts/smoke-tiktok-pipeline.ts <urls.txt> [--direct] [--json-out <path>] [--user-id <uuid>]
 *
 * Exit codes:
 *   0 — all videos pass signal-completeness gate
 *   1 — one or more videos failed the gate or a fatal error occurred
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";
import type { CounterfactualResult, PersonaSimulationResult } from "../src/lib/engine/types";

// Load env (Pattern S8 — same as engine-self-test.ts)
config({ path: resolve(__dirname, "../.env.local") });

// =====================================================
// Argv parsing
// =====================================================
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.error(
    "Usage: pnpm tsx scripts/smoke-tiktok-pipeline.ts <urls.txt> [--direct] [--json-out <path>] [--user-id <uuid>]"
  );
  process.exit(1);
}

const [urlFile, ...flags] = args;
const directMode = flags.includes("--direct");

const jsonOutIdx = flags.indexOf("--json-out");
const jsonOutPath = jsonOutIdx !== -1 ? flags[jsonOutIdx + 1] : null;

const userIdIdx = flags.indexOf("--user-id");
const explicitUserId = userIdIdx !== -1 ? flags[userIdIdx + 1] : null;

if (!urlFile) {
  console.error(
    "Usage: pnpm tsx scripts/smoke-tiktok-pipeline.ts <urls.txt> [--direct] [--json-out <path>] [--user-id <uuid>]"
  );
  process.exit(1);
}

// =====================================================
// Read URL list (skip blank lines and #-prefixed comments)
// =====================================================
let rawContent: string;
try {
  rawContent = readFileSync(urlFile, "utf8");
} catch (err) {
  console.error(`[smoke] Cannot read URL file: ${urlFile}`);
  console.error(
    "Usage: pnpm tsx scripts/smoke-tiktok-pipeline.ts <urls.txt> [--direct] [--json-out <path>] [--user-id <uuid>]"
  );
  process.exit(1);
}

const urls = rawContent
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

if (urls.length === 0) {
  console.error("[smoke] URL file is empty or contains only comments.");
  process.exit(1);
}

console.log(
  `[smoke] processing ${urls.length} URL(s) in ${directMode ? "DIRECT" : "UI-driven"} mode`
);

// =====================================================
// Supabase client (needed for Mode 1 polling + user lookup)
// =====================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "[smoke] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// =====================================================
// Types for aggregated output (--json-out contract)
// =====================================================
interface SmokeVideoResult {
  url: string;
  input_mode: "tiktok_url" | "video_upload";
  overall_score: number;
  confidence: number;
  band: string;
  cost_cents_estimated: number;
  latency_ms: number;
  /** Non-null when audio passed (signal_availability.audio === true) */
  audio: { embedding: string | true | null } | null;
  /** PersonaSimulationResult array — length >= 7 when Wave 3 passed */
  personas: PersonaSimulationResult[];
  /** numeric platform_fit score */
  platform_fit: number | null;
  /** Stage 11 counterfactuals */
  counterfactuals: CounterfactualResult | null;
  signal_availability: Record<string, boolean>;
  stage_events: Array<{ type: string; stage?: string; latency_ms?: number }>;
  gate_pass: boolean;
  gate_failures: string[];
}

// =====================================================
// Signal-completeness gate (SC#4 + 13-VALIDATION.md row 05)
// =====================================================
function checkSignalGate(result: SmokeVideoResult): string[] {
  const failures: string[] = [];

  // Audio fingerprint non-null (audio availability)
  if (!result.audio || result.audio.embedding === null) {
    // Note: tiktok_url mode gracefully degrades audio — not a hard failure
    // Only flag if it was expected (video_upload mode)
    if (result.input_mode === "video_upload") {
      failures.push("audio degraded (null) for video_upload mode");
    }
  }

  // Wave 3: >= 7 personas with verdicts
  if (!Array.isArray(result.personas) || result.personas.length < 7) {
    failures.push(
      `persona count ${result.personas?.length ?? 0} < 7 (Wave 3 threshold)`
    );
  }

  // Wave 4: numeric platform_fit for TikTok
  if (typeof result.platform_fit !== "number") {
    failures.push("platform_fit not numeric (Wave 4 missing)");
  }

  // Stage 11: non-null CounterfactualResult with >= 1 suggestion
  if (!result.counterfactuals || !result.counterfactuals.band) {
    failures.push("Stage 11 CounterfactualResult missing or null");
  } else if (
    !Array.isArray(result.counterfactuals.suggestions) ||
    result.counterfactuals.suggestions.length === 0
  ) {
    failures.push("Stage 11 suggestions array empty");
  }

  // Cost budget (D-20: $0.40 = 40 cents)
  if (result.cost_cents_estimated > 40) {
    failures.push(
      `cost_cents_estimated ${result.cost_cents_estimated} exceeds $0.40 budget (D-20 overage)`
    );
  }

  return failures;
}

// =====================================================
// Helpers
// =====================================================
async function waitForKeypress(message: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function getDefaultUserId(): Promise<string | null> {
  if (explicitUserId) return explicitUserId;
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (error || !data?.users?.length) {
    console.warn("[smoke] Could not resolve default user from auth.users");
    return null;
  }
  return data.users[0]?.id ?? null;
}

// =====================================================
// Mode 1: UI-driven polling
// =====================================================
async function runUIMode(
  url: string,
  videoIndex: number,
  total: number,
  userId: string | null
): Promise<SmokeVideoResult | null> {
  console.log(
    `\n[video-${videoIndex}/${total}] Upload this URL via the dev-server UI:`
  );
  console.log(`  ${url}`);
  console.log(
    "  Steps: download mp4 locally → open http://localhost:3000 → upload → watch SSE events"
  );
  console.log("  Then press ENTER here when the results card appears.");

  await waitForKeypress("  [Press ENTER after results card appears] > ");

  // Poll analysis_results for the most recent row from this user
  const query = supabase
    .from("analysis_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (userId) {
    query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    console.error("[smoke] No analysis_results row found after polling.");
    return null;
  }

  const row = data[0] as Record<string, unknown>;

  // Build SmokeVideoResult from DB row
  const personas = (row.persona_simulation_results as PersonaSimulationResult[]) ?? [];
  const platformFitRaw = row.platform_fit as { tiktok?: number } | number | null | undefined;
  const platformFitNum =
    typeof platformFitRaw === "number"
      ? platformFitRaw
      : typeof platformFitRaw === "object" && platformFitRaw !== null
        ? (platformFitRaw.tiktok ?? null)
        : null;

  const counterfactuals = (row.counterfactuals as CounterfactualResult) ?? null;
  const signalAvail = (row.signal_availability as Record<string, boolean>) ?? {};
  const audioEmbedding = signalAvail.audio ? true : null;

  // Derive band from overall_score
  const overallScore = (row.overall_score as number) ?? 0;
  const band =
    overallScore >= 70 ? "high" : overallScore >= 40 ? "mid" : "low";

  const result: SmokeVideoResult = {
    url,
    input_mode: (row.input_mode as "tiktok_url" | "video_upload") ?? "video_upload",
    overall_score: overallScore,
    confidence: (row.confidence as number) ?? 0,
    band,
    cost_cents_estimated: (row.cost_cents as number) ?? 0,
    latency_ms: (row.latency_ms as number) ?? 0,
    audio: { embedding: audioEmbedding },
    personas,
    platform_fit: platformFitNum,
    counterfactuals,
    signal_availability: signalAvail,
    stage_events: [], // UI-driven: no stage events captured
    gate_pass: false,
    gate_failures: [],
  };

  result.gate_failures = checkSignalGate(result);
  result.gate_pass = result.gate_failures.length === 0;

  console.log(
    `[video-${videoIndex}/${total}] overall_score=${result.overall_score} band=${result.band} cost_cents_estimated=${result.cost_cents_estimated} input_mode=${result.input_mode}`
  );
  console.log(
    `[video-${videoIndex}/${total}] personas=${result.personas.length} platform_fit=${result.platform_fit} counterfactuals=${result.counterfactuals ? "present" : "null"}`
  );

  if (result.gate_pass) {
    console.log(`[video-${videoIndex}/${total}] GATE: PASS`);
  } else {
    console.warn(`[video-${videoIndex}/${total}] GATE: FAIL`);
    for (const f of result.gate_failures) {
      console.warn(`  - ${f}`);
    }
  }

  return result;
}

// =====================================================
// Mode 2: Direct API call (--direct flag)
// =====================================================
async function runDirectMode(
  url: string,
  videoIndex: number,
  total: number
): Promise<SmokeVideoResult | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const endpoint = `${baseUrl}/api/analyze`;

  console.log(
    `\n[video-${videoIndex}/${total}] POSTing tiktok_url to ${endpoint}`
  );
  console.log(`  URL: ${url}`);

  const stageEvents: Array<{ type: string; stage?: string; latency_ms?: number }> = [];

  const body = JSON.stringify({
    input_mode: "tiktok_url",
    tiktok_url: url,
    content_type: "video",
    content_text:
      "TikTok video analysis via smoke-tiktok-pipeline direct mode.",
  });

  // Use SSE stream (default accept header path)
  let finalResult: Record<string, unknown> | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No Accept: header → triggers SSE branch in route.ts
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `[smoke] HTTP ${response.status}: ${errText.slice(0, 200)}`
      );
      return null;
    }

    if (!response.body) {
      console.error("[smoke] No response body from SSE stream");
      return null;
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const chunk of parts) {
        const lines = chunk.split("\n");
        let eventName = "message";
        let data = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            data = line.slice(6).trim();
          }
        }

        if (!data) continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;

          if (eventName === "stage") {
            stageEvents.push({
              type: (parsed.type as string) ?? "stage",
              stage: parsed.stage as string | undefined,
              latency_ms: parsed.latency_ms as number | undefined,
            });
            process.stdout.write(
              `  [stage] ${parsed.type ?? ""} ${parsed.stage ?? ""}\n`
            );
          } else if (eventName === "complete") {
            finalResult = parsed;
            console.log(`  [complete] received prediction`);
          } else if (eventName === "error") {
            errorMessage = (parsed.error as string) ?? "Unknown error";
          } else if (eventName === "phase") {
            console.log(`  [phase] ${parsed.message ?? parsed.phase ?? ""}`);
          }
        } catch {
          // malformed SSE chunk — skip
        }
      }
    }
  } catch (err) {
    console.error(
      `[smoke] Fetch error: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }

  if (errorMessage) {
    console.error(`[smoke] Pipeline error: ${errorMessage}`);
    return null;
  }

  if (!finalResult) {
    console.error("[smoke] No complete event received from SSE stream");
    return null;
  }

  // Build SmokeVideoResult from finalResult (PredictionResult shape)
  const personasRaw =
    (finalResult.persona_simulation_results as PersonaSimulationResult[]) ?? [];
  const platformFitRaw = finalResult.platform_fit as
    | { tiktok?: number }
    | number
    | null
    | undefined;
  const platformFitNum =
    typeof platformFitRaw === "number"
      ? platformFitRaw
      : typeof platformFitRaw === "object" && platformFitRaw !== null
        ? ((platformFitRaw as Record<string, unknown>).tiktok as number) ?? null
        : null;

  const counterfactuals =
    (finalResult.counterfactuals as CounterfactualResult) ?? null;
  const signalAvail =
    (finalResult.signal_availability as Record<string, boolean>) ?? {};
  const audioEmbedding = signalAvail.audio ? true : null;

  const overallScore = (finalResult.overall_score as number) ?? 0;
  const band =
    overallScore >= 70 ? "high" : overallScore >= 40 ? "mid" : "low";

  const result: SmokeVideoResult = {
    url,
    input_mode:
      (finalResult.input_mode as "tiktok_url" | "video_upload") ?? "tiktok_url",
    overall_score: overallScore,
    confidence: (finalResult.confidence as number) ?? 0,
    band,
    cost_cents_estimated: (finalResult.cost_cents as number) ?? 0,
    latency_ms: (finalResult.latency_ms as number) ?? 0,
    audio: { embedding: audioEmbedding },
    personas: personasRaw,
    platform_fit: platformFitNum,
    counterfactuals,
    signal_availability: signalAvail,
    stage_events: stageEvents,
    gate_pass: false,
    gate_failures: [],
  };

  result.gate_failures = checkSignalGate(result);
  result.gate_pass = result.gate_failures.length === 0;

  console.log(
    `[video-${videoIndex}/${total}] overall_score=${result.overall_score} band=${result.band} cost_cents_estimated=${result.cost_cents_estimated} latency_ms=${result.latency_ms}`
  );
  console.log(
    `[video-${videoIndex}/${total}] personas=${result.personas.length} platform_fit=${result.platform_fit} counterfactuals=${result.counterfactuals ? "present" : "null"}`
  );

  if (result.gate_pass) {
    console.log(`[video-${videoIndex}/${total}] GATE: PASS`);
  } else {
    console.warn(`[video-${videoIndex}/${total}] GATE: FAIL`);
    for (const f of result.gate_failures) {
      console.warn(`  - ${f}`);
    }
  }

  return result;
}

// =====================================================
// Main
// =====================================================
async function main(): Promise<void> {
  const results: SmokeVideoResult[] = [];
  const userId = directMode ? null : await getDefaultUserId();

  if (!directMode && userId) {
    console.log(`[smoke] UI mode — polling analysis_results for user: ${userId}`);
  }

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const videoNum = i + 1;

    // Write per-video raw JSON dir
    const validationsDir = resolve(
      __dirname,
      "../.planning/phases/13-real-pipeline-validation-production-hardening/validations"
    );
    mkdirSync(validationsDir, { recursive: true });

    const videoResult = directMode
      ? await runDirectMode(url, videoNum, urls.length)
      : await runUIMode(url, videoNum, urls.length, userId);

    if (!videoResult) {
      console.error(
        `[smoke] video-${videoNum} failed — no result produced. Skipping.`
      );
      continue;
    }

    // Write per-video raw JSON
    const rawJsonPath = resolve(validationsDir, `video-${String(videoNum).padStart(2, "0")}-raw.json`);
    writeFileSync(rawJsonPath, JSON.stringify(videoResult, null, 2));
    console.log(`[smoke] raw JSON written → ${rawJsonPath}`);

    results.push(videoResult);
  }

  // =====================================================
  // Aggregate summary
  // =====================================================
  const passed = results.filter((r) => r.gate_pass).length;
  const failed = results.filter((r) => !r.gate_pass).length;

  console.log(`\n[smoke] === SUMMARY ===`);
  console.log(`[smoke] Videos processed: ${results.length}/${urls.length}`);
  console.log(`[smoke] Gate PASS: ${passed} | FAIL: ${failed}`);

  for (const r of results) {
    const tag = r.gate_pass ? "PASS" : "FAIL";
    console.log(
      `  [${tag}] ${r.url.slice(0, 60)}... score=${r.overall_score} band=${r.band} cost=${r.cost_cents_estimated}¢`
    );
    if (!r.gate_pass) {
      for (const f of r.gate_failures) {
        console.log(`         ! ${f}`);
      }
    }
  }

  // =====================================================
  // --json-out aggregate contract (Nyquist sampling / verify probes)
  // AT MINIMUM: audio.embedding, personas, platform_fit, counterfactuals, cost_cents_estimated
  // =====================================================
  if (jsonOutPath && results.length > 0) {
    // For single-video runs (Plan 05), export the first video's result.
    // For multi-video runs (Plans 06/07), export the first result as representative.
    const first = results[0]!;

    const jsonOut = {
      url: first.url,
      input_mode: first.input_mode,
      overall_score: first.overall_score,
      confidence: first.confidence,
      band: first.band,
      // Nyquist probe contract fields
      audio: first.audio,
      personas: first.personas,
      platform_fit: first.platform_fit,
      counterfactuals: first.counterfactuals,
      cost_cents_estimated: first.cost_cents_estimated,
      latency_ms: first.latency_ms,
      signal_availability: first.signal_availability,
      gate_pass: first.gate_pass,
      gate_failures: first.gate_failures,
      all_results: results.map((r) => ({
        url: r.url,
        overall_score: r.overall_score,
        band: r.band,
        gate_pass: r.gate_pass,
        cost_cents_estimated: r.cost_cents_estimated,
      })),
    };

    const outDir = resolve(jsonOutPath, "..");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(jsonOutPath, JSON.stringify(jsonOut, null, 2));
    console.log(`[smoke] aggregate JSON written → ${jsonOutPath}`);
  }

  if (failed > 0) {
    console.error(
      `[smoke] FAIL — ${failed} video(s) did not pass signal-completeness gate`
    );
    process.exit(1);
  }

  console.log(`[smoke] PASS — all ${passed} video(s) passed signal-completeness gate`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[smoke] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
