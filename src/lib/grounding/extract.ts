/**
 * grounding/extract.ts — teardown extraction (productizes spike-grounding-v2's
 * extractTeardowns into the grounded-generation bounded context).
 *
 * Tears each proven outlier into a REUSABLE framework (§11b): name the mechanism,
 * generalize the template with [slots], decompose the idea — NOT a topic summary.
 * One extraction yields hook + format + idea proof simultaneously; skills query the
 * facet they need.
 *
 * Text tier only (metadata / caption / native-transcript) — the spike-proven, cheap,
 * on-critical-path tier. Visual-hook / editing-style are video-proof (§11b) and only
 * reliably filled by a later omni WATCH pass (finding #1, token-appended mp4); the
 * text tier emits them only when the caption/transcript makes them evident, else null.
 *
 * Model: QWEN_REASONING_MODEL (qwen3.7-plus), thinking-off, temp 0 + seed → deterministic
 * (matches the spike + MODEL-POLICY). DashScope compatible-mode via the shared qwen client.
 * No gemini, no embeddings — pure text-in / JSON-out.
 */

import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { classifyFacet, type Teardown, type HookSource, type IdeaFacet, type TeardownTemplate } from "./types";

// ─── Input ──────────────────────────────────────────────────────────────────
/** Content signals for ONE outlier fed to the extractor (the orchestrator assembles these). */
export interface ExtractionInput {
  caption: string;
  hashtags: string[];
  /** Native-transcript opening (Option A). null → Option B caption fallback (§8). */
  opening: string | null;
  views: number;
  /** Outlier multiplier (for the model's sense of scale; not stored via this fn). */
  multiplier: number;
  baselineLabel: string;
}

// ─── Prompt ─────────────────────────────────────────────────────────────────
const SYSTEM =
  "You are a short-form video analyst. Tear each proven outlier into a REUSABLE framework — " +
  "name the mechanism, generalize the structure so any niche could fill it, decompose the idea. " +
  "Do NOT summarize the topic. Output a single JSON object, no prose.";

/** The per-teardown shape we ask Qwen to return (facets are seed vocab — §11b). */
function contract(n: number): string {
  return (
    `Tear down these ${n} proven TikTok outliers. Return EXACTLY ${n} teardowns, IN ORDER.\n` +
    `JSON shape:\n` +
    `{ "teardowns": [ {\n` +
    `  "hookArchetype": string,   // e.g. Question, Secret Reveal Breakdown, Contrarian, List, Case Study, Trap Mistake\n` +
    `  "format": string,          // container: Tutorial, Listicle, Problem Solution, A vs B, Day in the Life, Skit, Q&A…\n` +
    `  "visualHook": string|null, // ONLY if the caption/transcript makes the first-frame device evident, else null\n` +
    `  "editingStyle": string|null,// ONLY if evident from text, else null\n` +
    `  "signatureSeries": string|null,\n` +
    `  "spokenHook": string,      // best reconstruction of the opening line\n` +
    `  "idea": { "seed": string, "angle": string, "belief": string, "reality": string, "evidence": string },\n` +
    `  "template": { "name": string, "slots": [ { "key": string, "label": string, "example": string } ], "skeleton": [string], "guidance": string },\n` +
    `  "whyItWorks": string       // one sentence: the retention mechanism\n` +
    `} ] }\n` +
    `Every field required except the three marked null-able. "template" must GENERALIZE (bracketed [slots] any niche fills), not restate the source.`
  );
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function buildPayload(inputs: ExtractionInput[]): string {
  return inputs
    .map(
      (v, i) =>
        `VIDEO ${i + 1} — ${fmtViews(v.views)} views, ${v.multiplier.toFixed(1)}× ${v.baselineLabel}\n` +
        `opening (spoken/transcript): ${v.opening ?? "(none — infer from caption/on-screen)"}\n` +
        `caption: ${v.caption}\n` +
        `hashtags: ${v.hashtags.join(" ")}`,
    )
    .join("\n\n");
}

// ─── Pure mapping (unit-testable without the LLM) ────────────────────────────
/** The loosely-typed per-item object Qwen returns (any field may be missing/misshaped). */
interface RawTeardown {
  hookArchetype?: unknown;
  format?: unknown;
  visualHook?: unknown;
  editingStyle?: unknown;
  signatureSeries?: unknown;
  spokenHook?: unknown;
  idea?: unknown;
  template?: unknown;
  whyItWorks?: unknown;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function mapIdea(v: unknown): IdeaFacet | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const seed = str(o.seed), angle = str(o.angle);
  // require at least a seed or angle to count as a real idea decomposition
  if (!seed && !angle) return null;
  return {
    seed: seed ?? "",
    angle: angle ?? "",
    belief: str(o.belief) ?? "",
    reality: str(o.reality) ?? "",
    evidence: str(o.evidence) ?? "",
  };
}

function mapTemplate(v: unknown): TeardownTemplate | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name);
  const skeleton = Array.isArray(o.skeleton) ? o.skeleton.map(str).filter((s): s is string => !!s) : [];
  const slots = Array.isArray(o.slots)
    ? o.slots
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const so = s as Record<string, unknown>;
          const key = str(so.key);
          if (!key) return null;
          return { key, label: str(so.label) ?? key, example: str(so.example) ?? "" };
        })
        .filter((s): s is { key: string; label: string; example: string } => !!s)
    : [];
  if (!name && skeleton.length === 0 && slots.length === 0) return null;
  return { name: name ?? "", slots, skeleton, guidance: str(o.guidance) ?? "" };
}

/**
 * Map the parsed LLM response into Teardown[] aligned 1:1 with `inputs` (same length
 * + order). Facets are normalized through classifyFacet (soft vocab). `hookSource` is
 * set by US from opening-presence (honest: native_transcript vs caption_fallback), not
 * trusted from the model. Missing/short items degrade to a null-filled Teardown (never
 * fabricated) so the orchestrator can skip caching a junk row.
 */
export function mapExtractionResponse(parsed: unknown, inputs: ExtractionInput[]): Teardown[] {
  const list: RawTeardown[] =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { teardowns?: unknown }).teardowns)
      ? ((parsed as { teardowns: unknown[] }).teardowns as RawTeardown[])
      : [];

  return inputs.map((input, i): Teardown => {
    const t = list[i] ?? {};
    const hookSource: HookSource | null = input.opening ? "native_transcript" : "caption_fallback";
    return {
      spokenHook: str(t.spokenHook),
      hookSource,
      hookArchetype: classifyFacet("hook_archetype", str(t.hookArchetype)).slug,
      format: classifyFacet("format", str(t.format)).slug,
      visualHook: classifyFacet("visual_hook", str(t.visualHook)).slug,
      editingStyle: classifyFacet("editing_style", str(t.editingStyle)).slug,
      signatureSeries: classifyFacet("signature_series", str(t.signatureSeries)).slug,
      idea: mapIdea(t.idea),
      template: mapTemplate(t.template),
      whyItWorks: str(t.whyItWorks),
      raw: (t as Record<string, unknown>) ?? null,
    };
  });
}

/** A Teardown carries no reusable signal if it has neither a hook nor a template/idea. */
export function isUsableTeardown(t: Teardown): boolean {
  return Boolean(t.spokenHook || t.template || t.idea);
}

// ─── The call ────────────────────────────────────────────────────────────────
/**
 * Extract reusable teardowns for a batch of proven outliers (ONE Qwen call). Returns
 * Teardown[] aligned 1:1 with `inputs`. Throws on a hard LLM/parse failure so the
 * caller degrades to no-grounding (honesty spine: never fabricate a source).
 */
export async function extractTeardowns(inputs: ExtractionInput[]): Promise<Teardown[]> {
  if (inputs.length === 0) return [];
  const ai = getQwenClient();
  const maxTokens = Math.min(8000, inputs.length * 900 + 600);

  const res = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${contract(inputs.length)}\n\n${buildPayload(inputs)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      enable_thinking: false, // DashScope param (cast) — thinking-off guarantees completion (spike)
      max_tokens: maxTokens,
    } as never,
  );

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("extractTeardowns: empty LLM response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("extractTeardowns: LLM returned non-JSON");
  }
  return mapExtractionResponse(parsed, inputs);
}
