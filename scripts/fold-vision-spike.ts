/**
 * Fold vision spike (throwaway — measurement only).
 *
 * Question: should the fold WATCH the video (sense-complete) instead of reasoning
 * over Omni's text? And which model — the deaf+blind 3.6-flash (today), or a
 * sense-complete omni-flash / omni-plus?
 *
 * Method: run Omni once to get the shared substrate (segments/verbatim/emotion_arc/
 * slots), then run the SAME fold prompt three ways and compare persona-curve
 * DIVERSITY (avgRange — the fold's whole value), latency, and cost:
 *   A) baseline  : qwen3.6-flash, TEXT only      (today's prod fold)
 *   B) sense-flash: qwen3.5-omni-flash + video    (cheap, sees+hears)
 *   C) sense-plus : qwen3.5-omni-plus  + video    (best audio understanding)
 *
 * DIVERSITY_FLOOR = 0.10. If a sighted arm holds spread >= baseline at acceptable
 * latency, the fold moves to that model. If sighted arms flatten, fold stays a reasoner.
 *
 * Run: npx tsx scripts/fold-vision-spike.ts ["/path/to/video.mp4"]
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

import { createClient } from "@supabase/supabase-js";
import { analyzeVideoWithOmni } from "../src/lib/engine/qwen/omni-analysis";
import { selectPersonaSlots } from "../src/lib/engine/wave3/persona-registry";
import { computeAvgCurveRange } from "../src/lib/engine/wave3/fold";
import {
  STABLE_FOLD_SYSTEM_PROMPT,
  buildFoldUserContent,
  FoldResponseSchema,
} from "../src/lib/engine/wave3/fold-prompts";
import { getQwenClient, QWEN_SEED } from "../src/lib/engine/qwen/client";
import { calculateCost } from "../src/lib/engine/qwen/cost";
import { stripModelOutput } from "../src/lib/engine/utils/strip";
import type { SegmentGrid, EmotionArcPoint } from "../src/lib/engine/types";
import type { PersonaSlot } from "../src/lib/engine/wave3/persona-registry";

const VIDEO_PATH = process.argv[2] ?? "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4";
const FOLD_MAX_TOKENS = 4000;

interface ArmResult {
  label: string;
  model: string;
  ok: boolean;
  avgRange: number;
  latency_ms: number;
  cost_cents: number;
  curves: { archetype: string; range: number; curve: string }[];
  note?: string;
}

async function foldArm(
  label: string,
  model: string,
  videoUrl: string | null, // null = text-only (baseline)
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
): Promise<ArmResult> {
  const ai = getQwenClient();
  const textContent = buildFoldUserContent(slots, segments, verbatim, emotionArc) as { type: string }[];
  const content = videoUrl
    ? [{ type: "video_url", video_url: { url: videoUrl } }, ...textContent]
    : textContent;

  const t0 = performance.now();
  try {
    const resp = await ai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: STABLE_FOLD_SYSTEM_PROMPT },
        { role: "user", content: content as never },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      max_tokens: FOLD_MAX_TOKENS,
    } as never);
    const latency_ms = Math.round(performance.now() - t0);

    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(stripModelOutput(raw));
    const v = FoldResponseSchema.safeParse(parsed);
    const cost_cents = calculateCost(model, resp.usage ?? undefined);

    if (!v.success) {
      return { label, model, ok: false, avgRange: 0, latency_ms, cost_cents, curves: [], note: "Zod fail: " + v.error.message.slice(0, 120) };
    }

    const personas = v.data.personas;
    const avgRange = computeAvgCurveRange(personas);
    const curves = personas.map((p) => {
      const att = p.segment_reactions.map((r) => r.attention);
      const range = att.length ? +(Math.max(...att) - Math.min(...att)).toFixed(2) : 0;
      return { archetype: p.archetype, range, curve: att.map((a) => a.toFixed(2)).join(" ") };
    });
    return { label, model, ok: true, avgRange, latency_ms, cost_cents, curves };
  } catch (e) {
    const latency_ms = Math.round(performance.now() - t0);
    return { label, model, ok: false, avgRange: 0, latency_ms, cost_cents: 0, curves: [], note: "ERROR: " + (e instanceof Error ? e.message : String(e)).slice(0, 140) };
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env missing");
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const buf = readFileSync(VIDEO_PATH);
  const storagePath = `fold-spike/${Date.now()}.mp4`;
  console.log(`[spike] video=${VIDEO_PATH} (${(buf.length / 1e6).toFixed(1)}MB) → videos/${storagePath}`);
  const up = await supabase.storage.from("videos").upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error("upload failed: " + up.error.message);
  const { data: signed, error: signErr } = await supabase.storage.from("videos").createSignedUrl(storagePath, 3600);
  if (signErr || !signed?.signedUrl) throw new Error("sign failed: " + (signErr?.message ?? "no url"));
  const videoUrl = signed.signedUrl;

  // -------- Omni read (substrate) --------
  console.log(`[spike] omni read (${process.env.QWEN_OMNI_MODEL ?? "qwen3.5-omni-flash"})...`);
  const tOmni = performance.now();
  const omni = await analyzeVideoWithOmni(videoUrl, {});
  console.log(`[spike] omni read done in ${((performance.now() - tOmni) / 1000).toFixed(1)}s | segments=${omni.segments?.length ?? 0}`);

  const segments = omni.segments ?? [];
  if (segments.length === 0) throw new Error("omni returned 0 segments — cannot fold");

  const analysis = omni.geminiResult?.analysis as unknown as {
    hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
    emotion_arc?: EmotionArcPoint[];
  } | undefined;
  const hv = analysis?.hook_verbatim;
  const verbatim = hv ? [hv.spoken_words, hv.on_screen_text].filter(Boolean).join(" ") : "";
  const emotionArc: EmotionArcPoint[] = Array.isArray(analysis?.emotion_arc) ? analysis!.emotion_arc! : [];
  const slots = selectPersonaSlots(omni.wave0Result.content_type?.type ?? null, omni.wave0Result.niche?.primary_slug ?? null);
  console.log(`[spike] substrate: verbatim="${verbatim.slice(0, 60)}..." | emotion_arc=${emotionArc.length}pts | slots=${slots.length}`);

  // -------- Three fold arms (sequential, isolate latency) --------
  const arms: ArmResult[] = [];
  arms.push(await foldArm("A baseline (text)", "qwen3.6-flash", null, slots, segments, verbatim, emotionArc));
  arms.push(await foldArm("B sense-flash    ", "qwen3.5-omni-flash", videoUrl, slots, segments, verbatim, emotionArc));
  arms.push(await foldArm("C sense-plus     ", "qwen3.5-omni-plus", videoUrl, slots, segments, verbatim, emotionArc));

  // -------- Report --------
  console.log(`\n========== FOLD VISION SPIKE — DIVERSITY_FLOOR=0.10 ==========`);
  console.log(`arm                  model                ok   avgRange  latency   cost`);
  for (const a of arms) {
    console.log(
      `${a.label}  ${a.model.padEnd(20)} ${a.ok ? "✓" : "✗"}   ${a.avgRange.toFixed(2).padStart(6)}  ${(a.latency_ms / 1000).toFixed(1).padStart(6)}s  $${a.cost_cents.toFixed(4)}${a.note ? "  " + a.note : ""}`,
    );
  }
  console.log(`\n---- per-archetype curves ----`);
  for (const a of arms) {
    console.log(`\n[${a.label}] avgRange=${a.avgRange.toFixed(2)}`);
    for (const c of a.curves) console.log(`  ${c.archetype.padEnd(22)} range=${c.range.toFixed(2)}  [${c.curve}]`);
  }

  await supabase.storage.from("videos").remove([storagePath]);
  console.log(`\n[spike] cleaned up videos/${storagePath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[spike] FATAL:", e);
  process.exit(1);
});
