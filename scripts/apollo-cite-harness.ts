/**
 * Apollo §-cite FAITHFUL runtime harness  (Plan 01-01 Task 1, ENG-02).
 *
 * Why this exists (vs apollo-core-smoke.ts): the smoke is NOT the production path.
 * It reads the FULL .planning/corpus/KNOWLEDGE-CORE.md (the whole brain, incl. §2.6/§7/§8),
 * defines its OWN APOLLO_INSTRUCTION, dumps an ad-hoc signalBundle JSON, and asks for free
 * PROSE. None of that is what prod does → its §-cites are unfaithful evidence.
 *
 * This harness exercises the REAL Apollo path byte-for-byte:
 *   - system prompt = APOLLO_SYSTEM_PROMPT (the LEAN runtime core: §1–§6 only, §2.6/§7/§8 dropped)
 *   - user message  = buildDeepSeekUserMessage(...) (the real structured §4 JSON contract)
 *   - sighted       = videoUrl passed (matches prod video_upload mode)
 *   - call          = reasonWithDeepSeek(...) — the production function itself
 * Then it harvests every literal §-token from the STRUCTURED output and resolves each against
 * the lean core, separating AUDITABLE-METADATA fields (lever/evidence) from USER-FACING PROSE
 * fields (ceiling_capper / confidence_scope / suggestions / rewrites) — the split the remap+
 * prose-discipline decision (F31) turns on.
 *
 * Usage: pnpm tsx scripts/apollo-cite-harness.ts "<video.mp4>"
 *   (default: "$HOME/Downloads/TikTok Video Downloader.mp4")
 *
 * Evidence-only (D-01 audit-inline): edits NO engine file. Output → stdout (tee to a file).
 */
import { config } from "dotenv";
import { resolve, basename, extname } from "path";
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { analyzeVideoWithOmni } = require("../src/lib/engine/qwen/omni-analysis");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reasonWithDeepSeek, buildDeepSeekUserMessage } = require("../src/lib/engine/deepseek");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { APOLLO_SYSTEM_PROMPT } = require("../src/lib/engine/apollo-core");

const videoPath = process.argv[2] || `${process.env.HOME}/Downloads/TikTok Video Downloader.mp4`;

// ── Lean-core resolution whitelist ─────────────────────────────────────────
// Sections actually PRESENT in the runtime APOLLO_SYSTEM_PROMPT (apollo-core.ts §1–§6).
// A §-cite "resolves" iff its section is in this set. Anything else dangles.
const PRESENT = new Set([
  "§1",
  "§2", "§2.0", "§2.0a", "§2.1", "§2.2", "§2.3", "§2.4", "§2.5",
  "§3",
  "§4", "§4.1",
  "§5",
  "§6",
]);
// Known-dropped (T3.1) — flag explicitly so the table names WHY they dangle.
const DROPPED_RATIONALE: Record<string, string> = {
  "§2.6": "Behavioral layer — reserved/'Empty in v1', dropped T3.1",
  "§7":   "Audience knowledge — defers to persona-registry, dropped T3.1",
  "§8":   "Sources & Provenance — ~2k chars IP/citation bookkeeping, dropped T3.1",
};

const CITE_RE = /§\s*\d+(?:\.\d+)?[a-z]?/g;
function normCite(raw: string): string {
  return raw.replace(/\s+/g, ""); // "§ 2.1" → "§2.1"
}
function extractCites(s: string | null | undefined): string[] {
  if (!s) return [];
  return (s.match(CITE_RE) ?? []).map(normCite);
}
function resolves(cite: string): boolean {
  return PRESENT.has(cite);
}

/** Omni/DashScope wants mp4; transcode anything else first. */
function toMp4(p: string): Buffer {
  if (extname(p).toLowerCase() === ".mp4") return readFileSync(p);
  const out = resolve(tmpdir(), `apollo-cite-${process.pid}.mp4`);
  console.log(`  [transcode] ${extname(p)} → mp4 …`);
  execFileSync("ffmpeg", ["-y", "-i", p, "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", out], { stdio: "ignore" });
  return readFileSync(out);
}

async function main() {
  console.log(`\n████ Apollo §-cite FAITHFUL harness ████`);
  console.log(`█ video: ${basename(videoPath)}`);
  console.log(`█ system prefix: APOLLO_SYSTEM_PROMPT (${(APOLLO_SYSTEM_PROMPT.length / 4) | 0} ~tokens, lean §1–§6)`);
  console.log(`█ §-tokens present in lean prefix: ${extractCites(APOLLO_SYSTEM_PROMPT).filter((c, i, a) => a.indexOf(c) === i).sort().join(" ") || "(none literal)"}`);

  const supabase = createServiceClient();

  // 1. Host video → signed URL (same as prod re-host result)
  const bytes = toMp4(videoPath);
  const path = `apollo-cite/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const up = await supabase.storage.from("videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const signed = await supabase.storage.from("videos").createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);
  const signedVideoUrl = signed.data.signedUrl;

  try {
    // 2. Omni watches → sensor signals (the real wave-1 read)
    console.log("\n  [harness] Omni watching …");
    const t0 = Date.now();
    const omni = await analyzeVideoWithOmni(signedVideoUrl);
    console.log(`  [harness] Omni ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (!omni.geminiResult?.analysis) throw new Error("Omni returned null analysis — cannot exercise Apollo path");
    const analysis = omni.geminiResult.analysis;

    // 3. Build the EXACT production DeepSeekInput (mirrors pipeline.ts:660-679)
    const hookRaw = (analysis as any)?.hook_verbatim;
    const verbatim = hookRaw
      ? { hook: { spoken_words: hookRaw.spoken_words ?? null, on_screen_text: hookRaw.on_screen_text ?? null } }
      : null;
    const context = {
      input: {
        input_mode: "video_upload" as const,
        content_type: "video" as const,
        content_text: (analysis as any)?.content_summary ?? "",
        video_storage_path: path,
        mode: "score" as const,
      },
      gemini_analysis: analysis,
      rule_result: { rule_score: 50, matched_rules: [] },
      trend_enrichment: { trend_score: 0, matched_trends: [], trend_context: "Trend analysis running in parallel — results available in pipeline output.", hashtag_relevance: 0 },
      creator_context: undefined, // no creator in the harness — cites don't come from creator ctx
      verbatim,
      videoUrl: signedVideoUrl,
    };

    // Confirm the user message really carries the structured §4 JSON contract (faithfulness check)
    const um = buildDeepSeekUserMessage(context);
    console.log(`  [harness] user message ${(um.length / 4) | 0} ~tokens; structured-JSON contract present: ${um.includes('"dimensions"') && um.includes("lever")}`);

    // 4. Call the PRODUCTION Apollo function
    console.log("\n  [harness] Apollo (reasonWithDeepSeek, sighted) …");
    const t1 = Date.now();
    const out = await reasonWithDeepSeek(context);
    console.log(`  [harness] Apollo ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    if (!out) throw new Error("reasonWithDeepSeek returned null (circuit breaker / all retries failed)");
    const r = out.reasoning;

    // 5. Harvest §-tokens per field, split metadata vs prose
    type Hit = { cite: string; field: string; surface: "metadata" | "PROSE"; snippet: string };
    const hits: Hit[] = [];
    const push = (field: string, surface: "metadata" | "PROSE", s: string | null | undefined) => {
      for (const c of extractCites(s)) hits.push({ cite: c, field, surface, snippet: (s ?? "").trim().slice(0, 120) });
    };
    // AUDITABLE METADATA (cites belong here — remap validates them)
    r.dimensions.forEach((d: any) => {
      push(`dimensions[${d.name}].lever`, "metadata", d.lever);
      push(`dimensions[${d.name}].evidence`, "metadata", d.evidence);
    });
    r.rewrites.forEach((rw: any, i: number) => push(`rewrites[${i}].lever_fixed`, "metadata", rw.lever_fixed));
    // USER-FACING PROSE (cites must NOT leak here — prose discipline)
    push("ceiling_capper", "PROSE", r.ceiling_capper);
    push("confidence_scope", "PROSE", r.confidence_scope);
    (r.suggestions ?? []).forEach((s: any, i: number) => push(`suggestions[${i}].text`, "PROSE", s.text));
    r.rewrites.forEach((rw: any, i: number) => push(`rewrites[${i}].variant`, "PROSE", rw.variant));

    // ── DUMP: full structured output (for prose-leak eyeballing) ──
    console.log("\n  ── APOLLO STRUCTURED OUTPUT (faithful) ──");
    console.log(`  composite_score: ${r.composite_score}   confidence: ${r.confidence}`);
    console.log(`\n  ceiling_capper: ${r.ceiling_capper}`);
    console.log(`  confidence_scope: ${r.confidence_scope}`);
    console.log("\n  dimensions:");
    r.dimensions.forEach((d: any) => console.log(`    ${String(d.name).padEnd(12)} ${d.band.padEnd(6)} ${d.score}  lever=${d.lever}\n        evidence=${d.evidence}`));
    console.log("\n  suggestions:");
    (r.suggestions ?? []).forEach((s: any) => console.log(`    [${s.priority}] ${s.text}`));
    console.log("\n  rewrites:");
    r.rewrites.forEach((rw: any) => console.log(`    lever_fixed=${rw.lever_fixed}\n      variant=${rw.variant}`));

    // ── RESOLUTION TABLE ──
    const uniq = [...new Set(hits.map((h) => h.cite))].sort();
    console.log("\n\n  ═══════════════ §-CITE RESOLUTION TABLE ═══════════════");
    console.log(`  ${"§-token".padEnd(9)} ${"resolves?".padEnd(10)} count  fields`);
    const danglers: string[] = [];
    for (const c of uniq) {
      const ch = hits.filter((h) => h.cite === c);
      const ok = resolves(c);
      if (!ok) danglers.push(c);
      const verdict = ok ? "YES" : "NO ⚠";
      const fields = [...new Set(ch.map((h) => `${h.field}${h.surface === "PROSE" ? "*PROSE*" : ""}`))].join(", ");
      console.log(`  ${c.padEnd(9)} ${verdict.padEnd(10)} ${String(ch.length).padEnd(6)} ${fields}`);
    }

    // ── PROSE-LEAK verdict (the F31 question) ──
    const proseHits = hits.filter((h) => h.surface === "PROSE");
    console.log("\n  ─── PROSE-LEAK (F31: do cites leak to user-facing prose?) ───");
    if (proseHits.length === 0) {
      console.log("    CLEAN — no §-token in ceiling_capper / confidence_scope / suggestions / rewrites.variant");
    } else {
      console.log(`    LEAK — ${proseHits.length} §-token(s) in user-facing prose fields:`);
      for (const h of proseHits) console.log(`      ${h.cite}  in ${h.field}: "${h.snippet}"`);
    }

    // ── DANGLER verdict (the remap question) ──
    console.log("\n  ─── DANGLERS (cites that DON'T resolve to lean core) ───");
    if (danglers.length === 0) {
      console.log("    NONE — every emitted §-cite resolves to the lean runtime core.");
    } else {
      for (const c of danglers) {
        const why = DROPPED_RATIONALE[c] ?? (Number(c.replace(/[§.]/g, "").replace(/[a-z]/g, "")) >= 9 ? "likely hallucinated (no such section)" : "not present in lean core");
        console.log(`    ${c} — ${why}`);
      }
    }
    console.log("\n  ═══════════════════════════════════════════════════════\n");

    // machine-readable footer for tee/grep
    console.log(`HARNESS_RESULT cites=[${uniq.join(",")}] danglers=[${danglers.join(",")}] prose_leaks=${proseHits.length} composite=${r.composite_score}`);
  } finally {
    await supabase.storage.from("videos").remove([path]).catch(() => {});
  }
}

main().catch((e) => { console.error("\n[harness] FATAL:", e?.stack ?? e?.message ?? e); process.exit(1); });
