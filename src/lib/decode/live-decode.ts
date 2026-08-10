/**
 * live-decode.ts — the request-time decode that makes Apify-first possible.
 *
 * Apify returns METRICS (views, likes, caption). The corpus stores the DECODE (hook pattern,
 * structure, the turn). Nothing produced a decode at request time, which is why "find me 3 viral
 * formats" could not be answered from a live scrape at all — a format IS a decode.
 *
 * Reads TEXT only: the free subtitle transcript + caption + metrics. No video tokens, no audio.
 * `qwen3.7-flash` is deaf, and the subtitle track supplies the spoken words for free (71% of real
 * videos, measured 2026-08-10). The four beats mirror `engine/remix/decode-types.ts`
 * (hook_pattern → structure_pacing → the_turn → emotional_beat) so a live decode and a corpus row
 * are the same shape.
 *
 * Returns null on ANY failure — a decode is an enrichment, never a reason to fail a request.
 */

import { fetchTranscript } from "./vtt";

export interface LiveDecode {
  hookPattern: string;
  structure: string;
  theTurn: string;
  emotionalBeat: string;
  /** Verbatim opening line from the transcript. NULL whenever there was no transcript. */
  spokenHook: string | null;
  source: "transcript" | "caption-only";
}

export interface DecodeVideoInput {
  platformVideoId: string;
  caption: string;
  views: number;
  likes: number;
  durationSeconds: number;
  subtitleUrl?: string;
}

type Complete = (params: Record<string, unknown>) => Promise<{
  choices?: Array<{ message?: { content?: string | null } }>;
}>;

/**
/**
 * The shape constraint is stated twice and shown once, deliberately. Measured 2026-08-10 across
 * two live runs, flash returned `structure` as an array of strings and then as an array of
 * `{step, description}` objects — the content was right both times and the decode was thrown
 * away over the container. Naming the type in prose is not enough; the example is what holds.
 *
 * ⚠️ The example is deliberately from an UNRELATED domain (a knife-sharpening video). A first
 * attempt used an example written from the test video itself, and flash returned it back
 * verbatim — a copied answer is indistinguishable from a decoded one when the two subjects
 * match. Keep the example far from anything this is likely to be run against.
 */
const SYSTEM = [
  "You decode short-form videos into their reusable STRUCTURE.",
  "Write in declarative third person about the video ('the hook', 'the creator') — never 'you'.",
  "Return ONLY JSON with keys: hookPattern, structure, theTurn, emotionalBeat, spokenHook.",
  "EVERY value must be a PLAIN STRING — never an array, never a nested object.",
  "structure is ONE string naming the beats in order, separated by arrows.",
  "Describe THIS video; the following example is only a SHAPE guide, never an answer:",
  '{"hookPattern":"Claim stated as a challenge","structure":"claim 0-2s → demonstration 2-14s →',
  'result held to camera 14-20s","theTurn":"The cheap tool outperforms the expensive one",',
  '"emotionalBeat":"Satisfaction at a myth debunked","spokenHook":"everyone sharpens a knife wrong"}',
  "spokenHook is the creator's OPENING LINE copied verbatim from the transcript, or null if no",
  "transcript was supplied. Never invent it from the caption.",
].join(" ");

const REQUIRED = ["hookPattern", "structure", "theTurn", "emotionalBeat"] as const;

/**
 * Coerce one beat to a string, repairing the one off-contract shape the model actually emits.
 *
 * Measured 2026-08-10 across two live runs on the same real video: flash returned `structure`
 * first as an array of strings, then as an array of `{step, description}` objects — correct
 * content, wrong container, decode discarded both times. The same family of slip is documented
 * for the card composer (handoff §3.1: `cards` arrived as a JSON string). SYSTEM now shows the
 * required shape by example; this is the belt to that braces, repairing the two containers
 * actually observed. Anything else is rejected rather than coerced into "[object Object]".
 */
function asBeat(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const parts = value.map((v) => {
      if (typeof v === "string") return v;
      // An array of {step, description} — keep the prose values, drop the keys.
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const strings = Object.values(v as Record<string, unknown>).filter(
          (x): x is string => typeof x === "string",
        );
        return strings.length ? strings.join(": ") : null;
      }
      return null;
    });
    if (parts.some((p) => p === null)) return null;
    return (parts as string[]).join(" → ").replace(/\s+/g, " ").trim() || null;
  }
  return null;
}

export async function decodeVideo(
  video: DecodeVideoInput,
  deps: { complete?: Complete; fetchTranscriptFn?: typeof fetchTranscript } = {},
): Promise<LiveDecode | null> {
  const fetchFn = deps.fetchTranscriptFn ?? fetchTranscript;
  const complete =
    deps.complete ??
    (async (params) => {
      // Lazy require so importing this module never pulls the OpenAI SDK into a client
      // bundle — the same pattern `src/lib/scraping/index.ts` uses for apify-client.
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("@/lib/engine/qwen/client");
      return getQwenClient().chat.completions.create({
        model: QWEN_REASONING_MODEL,
        seed: QWEN_SEED,
        ...params,
      });
    });

  const transcript = video.subtitleUrl ? await fetchFn(video.subtitleUrl) : null;
  const source: LiveDecode["source"] = transcript ? "transcript" : "caption-only";

  const user = [
    `Caption: ${video.caption}`,
    `Duration: ${video.durationSeconds}s · Views: ${video.views} · Likes: ${video.likes}`,
    transcript ? `Transcript: ${transcript}` : "Transcript: (none available)",
  ].join("\n");

  let raw: string;
  try {
    const res = await complete({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 700,
      enable_thinking: false,
      response_format: { type: "json_object" },
    });
    raw = res.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    // Null is the contract, but a SILENT null is undebuggable: the first live run returned one
    // and the reason (a truncated response) was invisible. Log the cause, still never throw.
    console.warn(`[live-decode] model call failed for ${video.platformVideoId}:`, e);
    return null;
  }

  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const beats: Record<string, string> = {};
    for (const k of REQUIRED) {
      const v = asBeat(p[k]);
      if (v === null) {
        console.warn(
          `[live-decode] ${video.platformVideoId}: missing/unusable required field "${k}"`,
        );
        return null;
      }
      beats[k] = v;
    }
    return {
      hookPattern: beats.hookPattern!,
      structure: beats.structure!,
      theTurn: beats.theTurn!,
      emotionalBeat: beats.emotionalBeat!,
      // Never let a caption-only decode claim a spoken hook.
      spokenHook: transcript && typeof p.spokenHook === "string" ? p.spokenHook : null,
      source,
    };
  } catch (e) {
    console.warn(
      `[live-decode] ${video.platformVideoId}: unparseable model output (${String(e)}); ` +
        `${raw.length} chars, starts "${raw.slice(0, 80)}"`,
    );
    return null;
  }
}
