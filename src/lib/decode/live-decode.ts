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

const SYSTEM = [
  "You decode short-form videos into their reusable STRUCTURE.",
  "Write in declarative third person about the video ('the hook', 'the creator') — never 'you'.",
  "Return ONLY JSON with keys: hookPattern, structure, theTurn, emotionalBeat, spokenHook.",
  "spokenHook is the creator's OPENING LINE copied verbatim from the transcript, or null if no",
  "transcript was supplied. Never invent it from the caption.",
].join(" ");

const REQUIRED = ["hookPattern", "structure", "theTurn", "emotionalBeat"] as const;

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
  } catch {
    return null;
  }

  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    for (const k of REQUIRED) {
      if (typeof p[k] !== "string" || !(p[k] as string).trim()) return null;
    }
    return {
      hookPattern: String(p.hookPattern),
      structure: String(p.structure),
      theTurn: String(p.theTurn),
      emotionalBeat: String(p.emotionalBeat),
      // Never let a caption-only decode claim a spoken hook.
      spokenHook: transcript && typeof p.spokenHook === "string" ? p.spokenHook : null,
      source,
    };
  } catch {
    return null;
  }
}
