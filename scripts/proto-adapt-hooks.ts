/**
 * proto-adapt-hooks.ts — PROTOTYPE of grounding-as-remix for the hooks skill.
 *
 * NOT wired into any runner. This is the experiment the 3-arm A/B never ran: instead of dumping a
 * 130-char madlib into the writer's bundle and hoping (the "transplant" that lost), it does what the
 * remix skill does — a FOCUSED adapt call that receives the FULL decoded anatomy of each proven
 * exemplar and reasons over it.
 *
 * The two things it adds over today's grounding, both straight from the owner's design:
 *   1. FULL DATA. Every field the corpus stores per row reaches the model — the beat skeleton, the
 *      `guidance` ("when to use this structure" = the fit signal), the belief↔reality tension, the
 *      format, the UNCLIPPED why-it-works. Today's hook prompt showed ~1% of this.
 *   2. A DOSAGE KNOB. The model chooses, PER hook, how hard to borrow — clone (a proven line that
 *      already fits, two words swapped) · swap (same structure, new subject) · angle (only the idea,
 *      fully re-voiced) · none (nothing fit; write original). Fit is judged against `guidance`, and a
 *      structure that does not fit is meant to be dropped, not forced.
 *
 * This runs as its own stage: it is NOT competing with the creator profile for the writer bundle's
 * char budget (the eviction hazard), so it can afford the full anatomy. Its output is compact.
 *
 * Exported for the A/B harness (scripts/ab-grounding-remix.ts). Prod untouched.
 */

import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { retrieveCachedExamples } from "@/lib/grounding/retrieve";
import type { RetrievedExample } from "@/lib/grounding/types";

export interface RemixHookInput {
  ask: string;
  platform: string;
  niche: string | null;
  /** The creator whose VOICE the hooks must land in — the half that got evicted before. */
  profile: {
    niche_primary?: string;
    target_audience?: string;
    primary_goal?: string;
    writing_voice_sample?: string;
    past_wins?: string[];
    past_flops?: string[];
  };
}

export type Dosage = "clone" | "swap" | "angle" | "none";

export interface RemixHook {
  hookLine: string;
  /** 1-based index of the exemplar this borrowed from, or 0 for none. */
  sourceIndex: number;
  dosage: Dosage;
  /** WHY that structure fit this ask (or, for none, why nothing did). One line. */
  fitReason: string;
}

export interface RemixHooksResult {
  hooks: RemixHook[];
  /** The exemplars the adapt stage was shown (for the receipt + audit). */
  exemplars: RetrievedExample[];
  raw: string;
}

/** Render ONE exemplar's FULL anatomy — no clipping. This is the whole point. */
function renderExemplar(ex: RetrievedExample, n: number): string {
  const L: string[] = [];
  const proof =
    ex.multiplier != null
      ? `proven · ${ex.multiplier}× ${ex.baselineLabel ?? "vs baseline"} · ${ex.views ?? "?"} views`
      : "curated exemplar (craft-picked, unmeasured)";
  L.push(`[${n}] ${proof}`);
  if (ex.hookArchetype) L.push(`    archetype: ${ex.hookArchetype}${ex.format ? ` · format: ${ex.format}` : ""}`);
  if (ex.hookTemplate) L.push(`    MADLIB (reusable skeleton): ${ex.hookTemplate}`);
  if (ex.spokenHook) L.push(`    ran as (the real line): "${ex.spokenHook}"`);
  if (ex.template?.guidance) L.push(`    WHEN TO USE THIS: ${ex.template.guidance}`);
  if (ex.template?.skeleton?.length) L.push(`    beat order: ${ex.template.skeleton.join(" → ")}`);
  if (ex.template?.beats?.length) {
    const beats = ex.template.beats
      .map((b) => `${b.name} — ${b.description}`)
      .join("  |  ");
    L.push(`    beats: ${beats}`);
  }
  if (ex.idea?.belief && ex.idea?.reality) {
    L.push(`    tension: audience believes "${ex.idea.belief}" → reality "${ex.idea.reality}"`);
  }
  if (ex.whyItWorks) L.push(`    why it worked (full): ${ex.whyItWorks}`);
  return L.join("\n");
}

const SYSTEM_PROMPT = `You are a short-form hook writer who works the way a great creator remixes: you study what has provably worked, then rebuild it for YOUR creator and YOUR audience — never a blind copy.

You will be given a creator (their niche, audience, goal, voice, and what has and hasn't worked for them), a specific ask, and a set of PROVEN hook structures torn down to full anatomy — the reusable skeleton, when that structure works, its beats, the belief-vs-reality tension underneath it, and why it went viral.

Write hooks for THIS creator's ask. For EACH hook, first decide how hard to borrow from a proven structure. This is a dial, not a switch:

- clone  — a proven line already fits this ask almost exactly; keep its shape and swap only the subject (sometimes two words). Use when the structure lands natively in this niche.
- swap   — keep the structure and beats, write a fresh line for this subject in the creator's voice.
- angle  — take only the underlying tension/idea; throw the wording away and write it fully in the creator's own voice.
- none   — nothing offered fits this ask. Do NOT force a structure. Write an original hook for the creator.

Judge fit HONESTLY against each structure's "when to use this." A structure built for a food taste-test does not fit a finance ask — pick 'none' rather than jam it in. A generic viral shell that would make this creator sound like everyone else is a worse hook than a plain one in their real voice.

Above all: every hook must sound like THIS creator (match their voice sample and what has worked for them), be about THEIR subject, and be a line a person would actually stop scrolling for. Borrow the engineering, not the words — unless the words genuinely already fit.

LENGTH IS A HARD CONSTRAINT. A hook is ONE scroll-stopping line, **15 words or fewer**. Short beats clever. Do NOT write two-sentence explanations, and do NOT spell out an enumerated list ("Level 1… Level 2… Level 3…") — name the frame, not every item. A hook the viewer has to read twice has already lost. If a borrowed structure only works at length, compress it or pick a different dosage.

Return exactly 5 hooks, each with a DISTINCT approach where possible.

OUTPUT: strict JSON, no prose, no fences:
{ "hooks": [ { "hookLine": string (ONE line, ≤ 15 words), "sourceIndex": number (1-N of the structure you borrowed, or 0 for none), "dosage": "clone"|"swap"|"angle"|"none", "fitReason": string (one line: why that structure fit this ask, or why nothing did) } ] }`;

/** The product's hook-length norm (matches remix adapt.ts). Enforced by the prompt, verified here. */
export const HOOK_WORD_CAP = 15;
export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

function buildUserContent(input: RemixHookInput, exemplars: RetrievedExample[]): string {
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

  const block = exemplars.map((ex, i) => renderExemplar(ex, i + 1)).join("\n\n");

  return `${creator}\n\nASK: ${input.ask}\n\nPROVEN STRUCTURES (full anatomy — borrow the engineering, judge fit against "when to use this"):\n\n${block}\n\nWrite the 5 hooks now.`;
}

export async function remixHooks(input: RemixHookInput): Promise<RemixHooksResult> {
  const retrieved = await retrieveCachedExamples({
    query: input.ask,
    platform: input.platform,
    skill: "hooks",
    niche: input.niche,
  });
  const exemplars = retrieved.examples;

  const ai = getQwenClient();
  const completion = await ai.chat.completions.create({
    model: QWEN_REASONING_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(input, exemplars) },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    seed: QWEN_SEED,
    max_tokens: 1600,
    // @ts-expect-error — DashScope extension not in OpenAI SDK types
    enable_thinking: false,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const cleaned = stripModelOutput(raw);
  let hooks: RemixHook[] = [];
  try {
    const parsed = JSON.parse(cleaned) as { hooks?: RemixHook[] };
    hooks = Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 5) : [];
  } catch {
    hooks = [];
  }
  return { hooks, exemplars, raw };
}
