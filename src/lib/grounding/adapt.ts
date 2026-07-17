/**
 * grounding/adapt.ts — ADAPT-AS-BRIEFER: the decode→adapt stage of grounding-as-remix.
 *
 * WHAT THIS REPLACES. Today the hooks writer is handed a raw corpus SLICE (prompt.ts →
 * `renderHooks`): a clipped madlib + a clipped why + a receipt, ~1% of what we store per teardown.
 * With no way to judge fit, it TRANSPLANTED — stuffed a proven skeleton in whether or not the
 * skeleton fit the ask. The first A/B (docs/AB-GROUNDING-3ARM-2026-07-14.md) measured that transplant
 * LOSING to writing cold. The failure was the transplant, not grounding.
 *
 * THE FIX (owner reframe: grounding is REMIX). Between retrieval and the writer, run ONE focused
 * adapt call that receives the FULL decoded anatomy of each proven structure — the beat skeleton,
 * `guidance` ("when to use this" = the literal fit signal), the belief↔reality tension, the format,
 * the unclipped why — and, per structure, decides HOW HARD TO BORROW (the dosage knob) and re-voices
 * it for THIS creator's ask. It emits a compact FITTED + DOSED brief. The existing hooks writer then
 * consumes that brief in place of the raw slice — so the SIM gate, the receipts/`sourceIndex` wiring,
 * and per-persona targeting all survive unchanged (only the `corpus` string's CONTENT changes).
 *
 *   clone — a proven line already fits this ask; keep its shape, swap the subject (sometimes 2 words).
 *   swap  — keep the structure/beats, write a fresh line in the creator's voice.
 *   angle — take only the tension/idea; throw the wording away, re-voice fully.
 *   none  — nothing here fits this ask; the structure is DROPPED from the brief, not forced.
 *
 * WHY A BRIEFER, NOT A WRITER. The prototype (scripts/proto-adapt-hooks.ts) wrote the final 5 hooks
 * itself. That bypasses the runner's SIM gate + per-persona ASSIGNMENT (the measured 60%-vs-13%
 * targeting win) + the sourceIndex→receipt link. Emitting a brief the EXISTING writer consumes keeps
 * every one of those. This stage runs BEFORE the writer bundle, with its own token budget, so it does
 * not compete with the creator's PROFILE for the bundle char-cap (the eviction hazard, §4b).
 *
 * HONESTY SPINE. The model authors the fit reasoning + the re-voiced structure only. The RECEIPT —
 * "proven by …" vs "curated exemplar —", and whether a multiplier may even be printed — is stamped by
 * CODE (`receipt`, shared with prompt.ts), never by the model. The numbered brief preserves order so
 * the writer's `sourceIndex` still maps 1:1 to the exemplar behind the on-card receipt.
 *
 * FAIL-SAFE. Any adapt failure (network, malformed JSON, everything judged 'none') falls back to the
 * proven raw-slice path (`buildCorpusBlock`) — grounding degrades to today's behavior, never to a
 * fabricated source and never to a crash. Default-off, hooks-only in Phase 1.
 */

import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import {
  buildCorpusBlock,
  clip,
  corpusBudgetFor,
  receipt,
  WARRANT_NOTE,
  type CorpusBlock,
  type GroundingSkill,
} from "./prompt";
import type { RetrievedExample } from "./types";

// ─── Public shapes ────────────────────────────────────────────────────────────

export type Dosage = "clone" | "swap" | "angle" | "none";
const DOSAGES: ReadonlySet<string> = new Set<Dosage>(["clone", "swap", "angle", "none"]);

/**
 * The creator whose VOICE the brief must re-target the proven structures toward — the half the raw
 * slice starved. Flat strings so the runner can flatten its ProfileRow (structured target_audience,
 * url-only wins) without this module knowing the profile schema.
 */
export interface AdaptProfile {
  niche_primary?: string | null;
  target_audience?: string | null;
  primary_goal?: string | null;
  writing_voice_sample?: string | null;
  past_wins?: string[] | null;
  past_flops?: string[] | null;
}

export interface AdaptCorpusInput {
  /** Which generate-by-remix skill is briefing. Hooks only in Phase 1 (ideas/script are fast-follow). */
  skill: GroundingSkill;
  /** The creator's ask — the same query retrieval ran on. Fit is judged against it. */
  ask: string;
  niche: string | null;
  platform: string;
  profile: AdaptProfile;
  /** The retrieved exemplars, in the order retrieval ranked them. */
  examples: RetrievedExample[];
}

/** The adapt LLM call, injectable so unit tests exercise the plumbing without the network. */
export type AdaptComplete = (system: string, user: string) => Promise<string>;
export interface AdaptDeps {
  complete?: AdaptComplete;
}

/** The model's per-structure verdict. `sourceIndex` is 1-based into the INPUT `examples`. */
interface AdaptedStructure {
  sourceIndex: number;
  dosage: Dosage;
  /** The proven structure, re-voiced/fitted to THIS ask — one short line (the writer's raw material). */
  fitted: string;
  /** Why that structure fits this ask (or, on 'none', why nothing did). One line. */
  fitReason: string;
}

// ─── Full-anatomy DECODE view (what the adapt stage reasons over) ──────────────

/**
 * Render ONE exemplar's FULL anatomy — no clipping. This is the whole point: the raw slice showed
 * the writer ~1% of this, so it could not judge fit. The adapt stage sees everything, once, in its
 * own budget.
 */
function renderExemplar(ex: RetrievedExample, n: number): string {
  const L: string[] = [];
  const proof =
    ex.multiplier != null
      ? `proven · ${ex.multiplier}× ${ex.baselineLabel ?? "vs baseline"} · ${ex.views ?? "?"} views`
      : "curated exemplar (craft-picked, unmeasured)";
  L.push(`[${n}] ${proof}`);
  if (ex.hookArchetype) {
    L.push(`    archetype: ${ex.hookArchetype}${ex.format ? ` · format: ${ex.format}` : ""}`);
  }
  if (ex.hookTemplate) L.push(`    MADLIB (reusable skeleton): ${ex.hookTemplate}`);
  if (ex.spokenHook) L.push(`    ran as (the real line): "${ex.spokenHook}"`);
  if (ex.template?.guidance) L.push(`    WHEN TO USE THIS: ${ex.template.guidance}`);
  if (ex.template?.skeleton?.length) L.push(`    beat order: ${ex.template.skeleton.join(" → ")}`);
  if (ex.template?.beats?.length) {
    const beats = ex.template.beats.map((b) => `${b.name} — ${b.description}`).join("  |  ");
    L.push(`    beats: ${beats}`);
  }
  if (ex.idea?.belief && ex.idea?.reality) {
    L.push(`    tension: audience believes "${ex.idea.belief}" → reality "${ex.idea.reality}"`);
  }
  if (ex.whyItWorks) L.push(`    why it worked (full): ${ex.whyItWorks}`);
  return L.join("\n");
}

// ─── The adapt prompt ──────────────────────────────────────────────────────────

/**
 * HOOKS-ONLY. The ≤20-word cap below is a HOOK craft norm — a hook is one scroll-stopping line, so
 * length IS the fit constraint. When Phase 2 extends adapt to ideas/script, they get their OWN prompt
 * and their OWN fit measure, NOT this word cap:
 *   • ideas  — the fitted output must carry a real belief↔reality TENSION (a belief + a contradicting
 *              reality, bound to the creator's subject). A one-clause platitude fails; length is moot.
 *   • script — the fitted output is a BEAT ARC (Hook→Setup→Turn→Payoff→CTA over the proven rhythm).
 *              The measure is arc completeness/order, not words.
 */
const SYSTEM_PROMPT = `You are a short-form REMIX strategist. A hook writer is about to write for a creator, and your job is to hand them a tight brief: take a set of PROVEN hook structures (each torn down to full anatomy — the reusable skeleton, when it works, its beats, the belief-vs-reality tension underneath it, and why it went viral) and, for EACH one, decide how it should be used for THIS creator's ask.

You do NOT write the final hooks — you prepare the raw material the writer will build from.

For each proven structure, decide how hard the writer should borrow it. This is a dial, not a switch:

- clone — a proven line already fits this ask almost exactly; keep its shape, swap only the subject.
- swap  — keep the structure and beats; the writer should pen a fresh line for this subject in the creator's voice.
- angle — only the underlying tension/idea transfers; the wording should be thrown away and re-voiced entirely.
- none  — nothing about this structure fits this ask. Say so. It will be DROPPED from the brief, not forced on the writer.

Judge fit HONESTLY against each structure's "when to use this." A structure built for a food taste-test does not fit a finance ask — mark it 'none' rather than jam it in. A generic viral shell that would make this creator sound like everyone else is worse than nothing.

For every structure you keep (clone/swap/angle), write a "fitted" line: the structure already re-pointed at THIS creator's subject and voice — the concrete thing the writer will shape into a hook. Keep it to ONE line, 20 words or fewer. Borrow the engineering, not the source's words or subject — unless (clone) the words genuinely already fit.

Return one entry PER input structure, in input order, each tagged with its 1-based sourceIndex.

OUTPUT: strict JSON, no prose, no fences:
{ "structures": [ { "sourceIndex": number (1-N, matching the input), "dosage": "clone"|"swap"|"angle"|"none", "fitted": string (one line ≤20 words; for 'none', an empty string), "fitReason": string (one line: why that structure fits this ask, or why it does not) } ] }`;

function buildUserContent(input: AdaptCorpusInput): string {
  const p = input.profile;
  const creator = [
    `CREATOR`,
    `  niche: ${p.niche_primary ?? input.niche ?? "(unspecified)"}`,
    p.target_audience ? `  audience: ${p.target_audience}` : "",
    p.primary_goal ? `  goal: ${p.primary_goal}` : "",
    p.writing_voice_sample ? `  voice (write like this): ${p.writing_voice_sample}` : "",
    p.past_wins?.length ? `  has worked: ${p.past_wins.join("; ")}` : "",
    p.past_flops?.length ? `  has flopped: ${p.past_flops.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const block = input.examples.map((ex, i) => renderExemplar(ex, i + 1)).join("\n\n");

  return `${creator}\n\nASK: ${input.ask}\n\nPROVEN STRUCTURES (full anatomy — judge fit against "when to use this", pick a dosage, and fit the keepers to this creator):\n\n${block}\n\nBrief the writer now.`;
}

// ─── The fitted brief the writer consumes (replaces the raw corpus slice) ──────

/**
 * The writer-facing header. Unlike the raw-slice header, it says the structures below are ALREADY
 * fitted to the ask and carry a DOSAGE recommendation. The two LOCKED honesty rules (WARRANT_NOTE)
 * and the sourceIndex-citation rule are unchanged — the writer still attributes exactly what it used.
 */
const BRIEF_HEADER =
  "GROUNDING — proven short-form hook structures, each ALREADY FITTED to your ask and tagged with " +
  "how hard to borrow it (the DOSAGE): clone = a proven line already fits — keep its shape, swap the " +
  "subject · swap = keep the structure, write a fresh line in the creator's voice · angle = take only " +
  "the tension, re-voice it fully. Build each hook in THIS creator's voice about THEIR subject — " +
  "borrow the engineering, never the source's words. " +
  WARRANT_NOTE +
  " Tag each hook with the sourceIndex (1-N) of the fitted structure it used, or 0 if none — never " +
  "cite a source you did not use.";

/** Cap the model-authored lines so one chatty entry cannot dominate the brief budget. */
const MAX_FITTED = 180;
const MAX_FIT_REASON = 160;

/** Render one kept structure into the brief. Receipt is CODE-stamped (honesty spine), never authored. */
function renderBriefEntry(ex: RetrievedExample, s: AdaptedStructure, n: number): string {
  const lines = [`${n}. [${s.dosage}] ${clip(s.fitted, MAX_FITTED)}`];
  if (s.fitReason.trim()) lines.push(`   why it fits: ${clip(s.fitReason, MAX_FIT_REASON)}`);
  // `receipt` supplies its own lead-in ("proven by" / "curated exemplar —"): only it knows the warrant.
  lines.push(`   ${receipt(ex)}`);
  return lines.join("\n");
}

// ─── Parse ─────────────────────────────────────────────────────────────────────

/** Coerce the model's structures array into validated AdaptedStructure[]. Never throws. */
function parseStructures(raw: string, exampleCount: number): AdaptedStructure[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripModelOutput(raw));
  } catch {
    return [];
  }
  const arr = (parsed as { structures?: unknown })?.structures;
  if (!Array.isArray(arr)) return [];

  const out: AdaptedStructure[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const idx =
      typeof r.sourceIndex === "number" && Number.isFinite(r.sourceIndex)
        ? Math.trunc(r.sourceIndex)
        : NaN;
    if (!Number.isInteger(idx) || idx < 1 || idx > exampleCount) continue;
    const dosage = typeof r.dosage === "string" ? (r.dosage.trim().toLowerCase() as Dosage) : "none";
    out.push({
      sourceIndex: idx,
      dosage: DOSAGES.has(dosage) ? dosage : "none",
      fitted: typeof r.fitted === "string" ? r.fitted : "",
      fitReason: typeof r.fitReason === "string" ? r.fitReason : "",
    });
  }
  return out;
}

// ─── Default LLM call ────────────────────────────────────────────────────────

async function defaultComplete(system: string, user: string): Promise<string> {
  const ai = getQwenClient();
  const completion = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      max_tokens: 1600,
      enable_thinking: false, // DashScope extension — not in the OpenAI SDK types
    } as never,
  );
  return completion.choices[0]?.message?.content ?? "";
}

// ─── The stage ─────────────────────────────────────────────────────────────────

/**
 * Route retrieved exemplars through the decode→adapt briefer. Returns the same `CorpusBlock`
 * shape `buildCorpusBlock` does — `{ corpus, used }` — so the caller (gather-for-run) and the
 * downstream sourceIndex→receipt mapping are untouched. `used` is the kept exemplars in brief order;
 * the writer's `sourceIndex` resolves positionally against it.
 *
 * Degrades to the raw-slice path on ANY failure or when every structure is judged 'none': grounding
 * falls back to today's proven behavior rather than crashing or silently dropping to ungrounded on
 * rows we already know are admissible.
 */
export async function adaptCorpusBlock(
  input: AdaptCorpusInput,
  deps: AdaptDeps = {},
): Promise<CorpusBlock> {
  const { examples, skill } = input;
  if (examples.length === 0) return { corpus: undefined, used: [] };

  const complete = deps.complete ?? defaultComplete;
  const fallback = () => buildCorpusBlock(examples, skill);

  let structures: AdaptedStructure[];
  try {
    const raw = await complete(SYSTEM_PROMPT, buildUserContent(input));
    structures = parseStructures(raw, examples.length);
  } catch (err) {
    console.warn(
      `[grounding] adapt stage failed (falling back to raw slice): ${err instanceof Error ? err.message : String(err)}`,
    );
    return fallback();
  }

  // Map verdicts back to input exemplars by sourceIndex (first wins), preserving INPUT order so
  // `used[i]` is exactly the exemplar rendered at brief position i+1.
  const byIndex = new Map<number, AdaptedStructure>();
  for (const s of structures) if (!byIndex.has(s.sourceIndex)) byIndex.set(s.sourceIndex, s);

  const budget = corpusBudgetFor(skill);
  const rendered: string[] = [];
  const used: RetrievedExample[] = [];
  let size = BRIEF_HEADER.length;

  examples.forEach((ex, i) => {
    const s = byIndex.get(i + 1);
    if (!s || s.dosage === "none" || !s.fitted.trim()) return; // dropped: nothing here fit this ask
    const line = renderBriefEntry(ex, s, used.length + 1);
    // +2 for the blank-line join. Keep at least one even if it alone is over budget (mirror buildCorpusBlock).
    if (used.length > 0 && size + line.length + 2 > budget) return;
    rendered.push(line);
    used.push(ex);
    size += line.length + 2;
  });

  if (used.length === 0) {
    // The adapt stage kept nothing. These rows are admissible + reusable (retrieval already gated
    // them), so an over-conservative sweep to 'none' is more likely than a true total no-fit — keep
    // the proven raw grounding rather than silently ungrounding the run.
    console.info(
      `[grounding] adapt kept 0/${examples.length} structures for "${input.ask}" — falling back to raw slice`,
    );
    return fallback();
  }

  return { corpus: `${BRIEF_HEADER}\n\n${rendered.join("\n\n")}`, used };
}
