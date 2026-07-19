/**
 * backfill-niche.ts — classify the curated corpus into a coarse niche taxonomy.
 *
 * WHY. `outlier_teardowns.niche`/`subniche` shipped 100% NULL from the sandcastles
 * import — the upstream record has no niche field, only free-text `topic` (98.5%).
 * The retrieval RPC's `filter_niche` param and any future corpus_stats GROUP BY
 * therefore filter/aggregate over nothing. This is the one dead facet with no
 * raw-JSONB rescue path — it needs a classification pass.
 *
 * WHAT. One sweep over the 524 extracted rows: topic + summary → a constrained
 * niche label (17-value enum below) + a short free-text subniche. Constrained
 * because a facet with 149 distinct values is free text, not a facet
 * (see signature_series). Subniche stays free — soft-vocab philosophy: hard
 * constraints only where retrieval depends on them.
 *
 * Deterministic: QWEN_REASONING_MODEL, temperature 0, seed QWEN_SEED — rerunning
 * yields the same labels.
 *
 * Run:  npx tsx scripts/backfill-niche.ts            (dry run — prints distribution)
 *       npx tsx scripts/backfill-niche.ts --write    (persists niche + subniche)
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("@/lib/engine/qwen/client");

const WRITE = process.argv.includes("--write");
const BATCH = 40;

/**
 * The taxonomy. Derived from a 60-topic random sample of the corpus (2026-07-19):
 * creator-strategy-heavy, with business/self-improvement/comedy/education tails.
 * Coarse on purpose — 524 rows can't support fine cells, and corpus_stats must
 * refuse below a minimum N anyway.
 */
const NICHES = [
  "content-creation", // growth strategy, hooks, editing tutorials, platform tactics
  "business",         // entrepreneurship, brand, SMB, marketing
  "finance",          // investing, real estate, money
  "self-improvement", // mindset, success principles, confidence, habits
  "education-science",// explainers, science, history, how-things-work
  "comedy-entertainment", // skits, parody, reactions, humor
  "food",             // cooking, recipes, food culture
  "travel",
  "lifestyle",        // vlogs, home, day-in-the-life, events
  "health-fitness",
  "beauty-fashion",
  "tech",             // gadgets, AI, software
  "art-design",       // visual art, animation, photography, music
  "sports",
  "relationships-family", // dating, parenting, friendship
  "career",           // jobs, workplace, professional pivots
  "other",
] as const;
type Niche = (typeof NICHES)[number];

interface Row {
  id: string;
  topic: string;
  summary: string;
}
interface Labeled {
  i: number;
  niche: string;
  subniche: string;
}

const SYSTEM = `You classify short-form video topics into creator niches.

Allowed niche values (use EXACTLY one of these strings):
${NICHES.map((n) => `- ${n}`).join("\n")}

Rules:
- "content-creation" is ONLY for videos about making content itself (growth strategy, editing tutorials, platform tactics, hook craft) — not for videos that merely ARE content.
- Prefer the specific niche over "other"; use "other" only when nothing fits.
- subniche: 1-4 lowercase words, more specific than the niche (e.g. "real estate investing", "capcut tutorials"). Never repeat the niche verbatim.

Return JSON: {"items":[{"i":<index>,"niche":"<enum>","subniche":"<text>"}]} — one entry per input, same "i".`;

async function classifyBatch(rows: Row[], offset: number): Promise<Labeled[]> {
  const qwen = getQwenClient();
  const payload = rows.map((r, idx) => ({
    i: offset + idx,
    topic: r.topic,
    summary: r.summary.slice(0, 200),
  }));
  const res = await qwen.chat.completions.create({
    model: QWEN_REASONING_MODEL,
    temperature: 0,
    seed: QWEN_SEED,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify({ videos: payload }) },
    ],
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
  if (!Array.isArray(parsed.items)) throw new Error("no items[] in response");
  return parsed.items as Labeled[];
}

function validate(items: Labeled[], offset: number, count: number): Map<number, { niche: Niche; subniche: string }> {
  const out = new Map<number, { niche: Niche; subniche: string }>();
  for (const it of items) {
    if (typeof it.i !== "number" || it.i < offset || it.i >= offset + count) continue;
    if (!NICHES.includes(it.niche as Niche)) continue;
    const sub = String(it.subniche ?? "").trim().toLowerCase().slice(0, 60);
    out.set(it.i, { niche: it.niche as Niche, subniche: sub });
  }
  return out;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Only extracted rows — the 8 failed shells stay NULL (nothing to classify).
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .select("id, teardown")
    .eq("source_pool", "curated")
    .eq("status", "extracted")
    .limit(1000);
  if (error) throw error;

  const rows: Row[] = (data ?? [])
    .map((r: { id: string; teardown: Record<string, unknown> }) => ({
      id: r.id,
      topic: String(r.teardown?.topic ?? "").trim(),
      summary: String(r.teardown?.summary ?? "").trim(),
    }))
    .filter((r: Row) => r.topic.length > 0);

  console.log(`\n${rows.length} extracted rows with a topic (of ${data?.length ?? 0} fetched)\n`);

  const labels = new Map<number, { niche: Niche; subniche: string }>();
  const skipped: { i: number; topic: string }[] = [];

  /**
   * DashScope's content filter (`data_inspection_failed`) rejects a whole batch
   * when ANY row trips it, deterministically — a plain retry hits the same wall.
   * Bisect instead: split the failing batch until the poisoned row(s) are
   * isolated, label everything else, and leave the poisoned rows NULL (reported).
   */
  async function classifyResilient(batch: Row[], offset: number): Promise<void> {
    let items: Labeled[] | null = null;
    try {
      items = await classifyBatch(batch, offset);
    } catch {
      if (batch.length === 1) {
        console.warn(`  SKIP row @${offset} (content filter): "${batch[0].topic.slice(0, 60)}"`);
        skipped.push({ i: offset, topic: batch[0].topic });
        return;
      }
      const mid = Math.ceil(batch.length / 2);
      console.warn(`  batch @${offset} (${batch.length}) rejected — bisecting`);
      await classifyResilient(batch.slice(0, mid), offset);
      await classifyResilient(batch.slice(mid), offset + mid);
      return;
    }
    let got = validate(items, offset, batch.length);
    // One retry for a batch that came back structurally valid but incomplete.
    if (got.size < batch.length) {
      console.warn(`  batch @${offset}: ${got.size}/${batch.length} valid — retrying once`);
      try {
        const retry = validate(await classifyBatch(batch, offset), offset, batch.length);
        for (const [k, v] of retry) if (!got.has(k)) got.set(k, v);
      } catch {
        /* keep the partial result */
      }
    }
    for (const [k, v] of got) labels.set(k, v);
  }

  for (let off = 0; off < rows.length; off += BATCH) {
    await classifyResilient(rows.slice(off, off + BATCH), off);
    console.log(`  through @${off + BATCH}: ${labels.size}/${rows.length} labeled`);
  }
  if (skipped.length) {
    console.log(`\n${skipped.length} rows skipped by the content filter (stay NULL):`);
    skipped.forEach((s) => console.log(`  @${s.i} "${s.topic.slice(0, 70)}"`));
  }

  // Distribution report — the honesty gate before any write.
  const dist = new Map<string, number>();
  for (const { niche } of labels.values()) dist.set(niche, (dist.get(niche) ?? 0) + 1);
  console.log(`\nNiche distribution (${labels.size} labeled, ${rows.length - labels.size} unlabeled → stay NULL):`);
  [...dist.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([n, c]) => console.log(`  ${String(c).padStart(4)}  ${n}`));

  console.log(`\nSample classifications:`);
  [...labels.entries()].slice(0, 20).forEach(([i, l]) => {
    console.log(`  "${rows[i].topic.slice(0, 48)}" → ${l.niche} / ${l.subniche}`);
  });

  if (!WRITE) {
    console.log(`\nDRY RUN — nothing written. Re-run with --write to persist.`);
    return;
  }

  console.log(`\nWriting niche + subniche…`);
  let written = 0;
  const entries = [...labels.entries()];
  for (let i = 0; i < entries.length; i += 20) {
    await Promise.all(
      entries.slice(i, i + 20).map(async ([idx, l]) => {
        const { error: upErr } = await supabase
          .from("outlier_teardowns")
          .update({ niche: l.niche, subniche: l.subniche || null })
          .eq("id", rows[idx].id);
        if (upErr) throw upErr;
        written++;
      }),
    );
  }
  console.log(`  ${written} rows updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
