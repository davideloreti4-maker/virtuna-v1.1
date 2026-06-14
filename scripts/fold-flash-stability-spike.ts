/**
 * Fold FLASH-STABILITY spike (throwaway — measurement only, no prod changes).
 *
 * Question: omni-flash hard-FAILS the fold via TYPE violations under
 * `response_format: { type: "json_object" }` (unconstrained types — flash emits
 * a non-number for scroll_past_second, null for string fields). Can we make
 * flash STABLE at flash price/speed? Two candidate fixes, same 1 video:
 *
 *   REF) omni-plus  + json_object              — known-pass baseline (avgRange ~0.39)
 *   P1)  omni-flash + json_schema (strict)     — constrained decoding forces valid TYPES
 *   P2)  omni-flash + json_object + COERCION   — preprocess raw JSON (coerce/clamp/default) before Zod
 *
 * DIVERSITY target: avgRange >= ~0.30 (near plus). Decision: if a flash arm is
 * VALID + diverse, flash can stay (3x faster, cheaper). Else flip fold->plus.
 *
 * Run: npx tsx scripts/fold-flash-stability-spike.ts ["/path/to/video.mp4"]
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
import { buildFoldUserContent, STABLE_FOLD_SYSTEM_PROMPT, FoldResponseSchema } from "../src/lib/engine/wave3/fold-prompts";
import { getQwenClient, QWEN_SEED } from "../src/lib/engine/qwen/client";
import { calculateCost } from "../src/lib/engine/qwen/cost";
import { stripModelOutput } from "../src/lib/engine/utils/strip";
import type { SegmentGrid, EmotionArcPoint } from "../src/lib/engine/types";
import type { PersonaSlot } from "../src/lib/engine/wave3/persona-registry";

const VIDEO_PATH = process.argv[2] ?? "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4";
const FOLD_MAX_TOKENS = 4000;

// ---- JSON Schema mirror of FoldResponseSchema (types/structure only; Zod still range-clamps) ----
const FOLD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    personas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          archetype: { type: "string" },
          persona_id: { type: "string" },
          watch_through_pct: { type: "number" },
          share_intent: { type: "number" },
          comment_intent: { type: "number" },
          save_intent: { type: "number" },
          rewatch_intent: { type: "number" },
          scroll_past_second: { type: "number" },
          segment_reactions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                attention: { type: "number" },
                swipe_predicted: { type: "boolean" },
              },
              required: ["attention", "swipe_predicted"],
            },
          },
        },
        required: [
          "archetype", "persona_id", "watch_through_pct", "share_intent",
          "comment_intent", "save_intent", "rewatch_intent", "scroll_past_second", "segment_reactions",
        ],
      },
    },
  },
  required: ["personas"],
} as const;

// ---- P2 coercion layer: salvage type-violations before Zod ----
function num(v: unknown, def = 0): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : def;
  }
  return def;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function coerceFold(raw: unknown): unknown {
  const r = raw as { personas?: unknown };
  const personas = Array.isArray(r?.personas) ? r.personas : [];
  return {
    personas: personas.map((p) => {
      const pp = p as Record<string, unknown>;
      const reactions = Array.isArray(pp?.segment_reactions) ? pp.segment_reactions : [];
      return {
        archetype: String(pp?.archetype ?? ""),
        persona_id: String(pp?.persona_id ?? ""),
        watch_through_pct: clamp(num(pp?.watch_through_pct), 0, 100),
        share_intent: clamp(num(pp?.share_intent), 0, 100),
        comment_intent: clamp(num(pp?.comment_intent), 0, 100),
        save_intent: clamp(num(pp?.save_intent), 0, 100),
        rewatch_intent: clamp(num(pp?.rewatch_intent), 0, 100),
        scroll_past_second: Math.max(0, num(pp?.scroll_past_second)),
        segment_reactions: reactions.map((rr) => {
          const r2 = rr as Record<string, unknown>;
          return {
            attention: clamp(num(r2?.attention), 0, 1),
            swipe_predicted: r2?.swipe_predicted === true || r2?.swipe_predicted === "true",
          };
        }),
      };
    }),
  };
}

interface ArmResult {
  label: string;
  model: string;
  mode: string;
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
  mode: "json_object" | "json_schema" | "json_object+coerce",
  videoUrl: string,
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
): Promise<ArmResult> {
  const ai = getQwenClient();
  const textContent = buildFoldUserContent(slots, segments, verbatim, emotionArc) as { type: string }[];
  const content = [{ type: "video_url", video_url: { url: videoUrl } }, ...textContent];

  const response_format =
    mode === "json_schema"
      ? { type: "json_schema", json_schema: { name: "fold_response", strict: true, schema: FOLD_JSON_SCHEMA } }
      : { type: "json_object" };

  const t0 = performance.now();
  try {
    const resp = await ai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: STABLE_FOLD_SYSTEM_PROMPT },
        { role: "user", content: content as never },
      ],
      response_format: response_format as never,
      temperature: 0,
      seed: QWEN_SEED,
      max_tokens: FOLD_MAX_TOKENS,
    } as never);
    const latency_ms = Math.round(performance.now() - t0);

    const raw = resp.choices[0]?.message?.content ?? "{}";
    let parsed: unknown = JSON.parse(stripModelOutput(raw));
    if (mode === "json_object+coerce") parsed = coerceFold(parsed);
    const v = FoldResponseSchema.safeParse(parsed);
    const cost_cents = calculateCost(model, resp.usage ?? undefined);

    if (!v.success) {
      return { label, model, mode, ok: false, avgRange: 0, latency_ms, cost_cents, curves: [], note: "Zod fail: " + v.error.message.slice(0, 140) };
    }
    const personas = v.data.personas;
    const avgRange = computeAvgCurveRange(personas);
    const curves = personas.map((p) => {
      const att = p.segment_reactions.map((r) => r.attention);
      const range = att.length ? +(Math.max(...att) - Math.min(...att)).toFixed(2) : 0;
      return { archetype: p.archetype, range, curve: att.map((a) => a.toFixed(2)).join(" ") };
    });
    return { label, model, mode, ok: true, avgRange, latency_ms, cost_cents, curves };
  } catch (e) {
    const latency_ms = Math.round(performance.now() - t0);
    return { label, model, mode, ok: false, avgRange: 0, latency_ms, cost_cents: 0, curves: [], note: "ERROR: " + (e instanceof Error ? e.message : String(e)).slice(0, 160) };
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

  console.log(`[spike] omni read (qwen3.5-omni-flash)...`);
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

  const arms: ArmResult[] = [];
  arms.push(await foldArm("REF omni-plus  json_object   ", "qwen3.5-omni-plus", "json_object", videoUrl, slots, segments, verbatim, emotionArc));
  arms.push(await foldArm("P1  omni-flash json_schema   ", "qwen3.5-omni-flash", "json_schema", videoUrl, slots, segments, verbatim, emotionArc));
  arms.push(await foldArm("P2  omni-flash json_obj+coerce", "qwen3.5-omni-flash", "json_object+coerce", videoUrl, slots, segments, verbatim, emotionArc));

  console.log(`\n========== FLASH-STABILITY SPIKE — target avgRange>=0.30 ==========`);
  console.log(`arm                              model                ok   avgRange  latency   cost`);
  for (const a of arms) {
    console.log(
      `${a.label}  ${a.model.padEnd(20)} ${a.ok ? "✓" : "✗"}   ${a.avgRange.toFixed(2).padStart(6)}  ${(a.latency_ms / 1000).toFixed(1).padStart(6)}s  $${a.cost_cents.toFixed(4)}${a.note ? "  " + a.note : ""}`,
    );
  }
  console.log(`\n---- per-archetype curves ----`);
  for (const a of arms) {
    console.log(`\n[${a.label}] ok=${a.ok} avgRange=${a.avgRange.toFixed(2)}`);
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
