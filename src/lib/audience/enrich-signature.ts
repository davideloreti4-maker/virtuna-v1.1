/**
 * §P BUILD step 3 — enrich-signature.ts (the heart).
 *
 * Turns ONE profile-bundle scrape into the frozen `AudienceSignature` via:
 *   (a) select the top ~3-5 videos by engagement (save+share weighted),
 *   (b) `qwen3.5-omni-flash` WATCHES each (video+audio) → content/format/voice notes
 *       (universal — works for talkers AND silent visual creators, the Khaby class, P.13),
 *   (c) ONE `qwen3.7-plus` synthesis (CALIBRATE: greedy temp:0, thinking-mode OFF per D-01) fuses stats + engagement + native subs + watchNotes
 *       → the AudienceSignature (creator persona + 10 reactors + derived weights + summary).
 *
 * Determinism (P.7): every LLM call runs `temperature:0, seed:QWEN_SEED`, system prompts
 * byte-stable (cache prefix). Output is FROZEN on the audience row — the per-skill hot path
 * never calls an LLM for the audience, so the engine stays byte-deterministic and the
 * General-regression gate stays free by construction (this module never runs for General).
 *
 * Replaces the constant `deriveAudienceProfile` (F1) + static `repaintPersonas`.
 *
 * Cost (P.8): ~$0.05-0.15 per audience, ONE-TIME. Native subs free; AI-transcribe NEVER.
 *
 * Testability: all I/O (mp4 resolve, omni watch, VTT fetch, text synthesis) is injectable
 * via `deps` so unit tests run with zero network/LLM. Defaults wire to the real stack.
 */

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import {
  getQwenClient,
  QWEN_OMNI_MODEL,
  QWEN_REASONING_MODEL,
  QWEN_SEED,
} from "@/lib/engine/qwen/client";
import { calculateCost } from "@/lib/engine/qwen/cost";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import { TEMPERATURE_DISPOSITION } from "./temperature-disposition";
import type { ProfileData, VideoData } from "@/lib/scraping/types";
import type {
  AudienceSignature,
  GoalIntent,
  SignaturePersona,
} from "./audience-types";

const log = createLogger({ module: "audience.enrich" });

// ─── Tunables ──────────────────────────────────────────────────────────────────

/** How many top videos the omni-flash layer watches (P.13: top ~3-5 by engagement). */
const MAX_WATCH = 5;
const MIN_WATCH = 3;
/** Max transcripts to fold into synthesis (the watched set; writing sample = the top one). */
const MAX_TRANSCRIPTS = 5;
const OMNI_TIMEOUT_MS = 60_000;
// Synth (qwen-3.7-plus, greedy temp:0, thinking-mode OFF per D-01) empirically ran ~60-90s with
// thinking ON; the old 60s ceiling aborted it systematically (spike 02-02 — the second bake
// reliably timed out at ~60s with "Request was aborted"). 120s keeps ample headroom now that
// thinking-mode is dropped (the call is strictly faster without the staging budget).
const SYNTH_TIMEOUT_MS = 120_000;
const SYNTH_MAX_TOKENS = 8000; // v2 personas add display_name/blurb/axes (~+1k) → persona output ~3.5k + headroom
const SUBTITLE_FETCH_TIMEOUT_MS = 8_000;
const SUBTITLE_MAX_CHARS = 2_000;

// ─── Watch note (Call A output) ─────────────────────────────────────────────────

const WatchNoteSchema = z.object({
  content: z.string().default(""),
  format: z.string().default(""),
  visual_style: z.string().default(""),
  audio: z.string().default(""),
  hook_type: z.string().default(""),
  why_it_works: z.string().default(""),
  creator_voice_1liner: z.string().default(""),
});
export type WatchNote = z.infer<typeof WatchNoteSchema>;

// Call A system prompt — BYTE-STABLE (cache prefix, D-17). Mirrors §P.14 Call A.
const WATCH_SYSTEM = `You analyze ONE TikTok to model the CREATOR's style and WHY their audience rewards it.
WATCH the visuals AND LISTEN to the audio. Return ONLY JSON, concrete, no preamble:
{"content","format","visual_style","audio","hook_type","why_it_works","creator_voice_1liner"}
("audio" = voice tone / music / sfx, or "no speech".)`;

// ─── Synthesis (Call B) output — LLM returns everything except provenance ────────

const SLOT_BY_ARCHETYPE: Record<string, "fyp" | "niche" | "loyalist" | "cross_niche"> = {
  tough_crowd: "fyp",
  lurker: "fyp",
  high_engager: "fyp",
  saver: "fyp",
  sharer: "fyp",
  purposeful_viewer: "niche",
  niche_deep_buyer: "niche",
  niche_deep_scout: "niche",
  loyalist: "loyalist",
  cross_niche_curiosity: "cross_niche",
};

const ARCHETYPE_SET = new Set<string>(ARCHETYPES);

// v2 scored axes (tolerant defaults — a sloppy model must never fail calibration; the axes
// are for the population math, the hard invariants below still gate the 10-slug contract).
const ReactionAxesSchema = z.object({
  interests: z.record(z.string(), z.number().min(0).max(1)).default({}),
  hookSensitivity: z.number().min(0).max(1).default(0.5),
  noveltyBias: z.number().min(0).max(1).default(0.5),
  skepticism: z.number().min(0).max(1).default(0.5),
  attentionSpan: z.number().min(0).max(1).default(0.5),
});
const BehaviorAxesSchema = z.object({
  watchThrough: z.number().min(0).max(1).default(0.5),
  sharePropensity: z.number().min(0).max(1).default(0.5),
  commentPropensity: z.number().min(0).max(1).default(0.5),
  savePropensity: z.number().min(0).max(1).default(0.5),
});

/** A reactor as the synthesis LLM returns it — engine fills temperature/disposition. */
const RawPersonaSchema = z.object({
  archetype: z.string(),
  share: z.number().min(0).max(1),
  reaction_frame: z.string().min(1),
  evidence: z.string().default(""),
  // v2: custom, creator-specific identity + scored axes (all optional — legacy-safe; undefined
  // means "the model didn't supply it" → the mapping skips it → display falls back to archetype).
  display_name: z.string().optional(),
  blurb: z.string().optional(),
  reaction: ReactionAxesSchema.optional(),
  behavior: BehaviorAxesSchema.optional(),
});

const SynthSchema = z.object({
  creator_persona: z.object({
    content_description: z.string().default(""),
    context: z.string().default(""),
    writing_style_sample: z.string().default(""),
    format_signature: z.string().default(""),
  }),
  audience: z.object({
    follower_tier: z.string().nullable().default(null),
    maturity: z.enum(["new", "growing", "established"]).default("growing"),
    temperature_mix: z.object({
      cold: z.number().min(0).max(1),
      warm: z.number().min(0).max(1),
      hot: z.number().min(0).max(1),
    }),
    interest_tags: z.array(z.string()).default([]),
    // v2: canonical topic vocab for this niche (niche subjects + cross-cutting appeal registers).
    topic_vocab: z.array(z.string()).default([]),
    what_resonates: z.string().default(""),
    what_falls_flat: z.string().default(""),
    persona_weights: z
      .object({
        fyp: z.number().min(0).max(1),
        niche: z.number().min(0).max(1),
        loyalist: z.number().min(0).max(1),
        cross_niche: z.number().min(0).max(1),
      })
      .refine((w) => Math.abs(w.fyp + w.niche + w.loyalist + w.cross_niche - 1) < 0.02, {
        message: "persona_weights must sum to 1.0 (±0.02)",
      }),
    personas: z
      .array(RawPersonaSchema)
      .length(10, "must be exactly 10 reactors")
      .refine(
        (ps) =>
          ps.every((p) => ARCHETYPE_SET.has(p.archetype)) &&
          new Set(ps.map((p) => p.archetype)).size === 10,
        { message: "personas must cover the 10 fixed archetype slugs exactly once" },
      )
      .refine((ps) => Math.abs(ps.reduce((s, p) => s + p.share, 0) - 1) < 0.02, {
        message: "persona shares must sum to 1.0 (±0.02)",
      }),
  }),
  summary: z.string().default(""),
});

// Call B system prompt — cache prefix (D-17). v2: personas are now custom-per-creator (each fixed
// slug also carries a creator-specific display_name/blurb + scored axes). Changing this string is a
// deliberate cache-prefix bump; determinism per identical input still holds (temp:0 + seed).
const SYNTH_SYSTEM = `You build a creator's AUDIENCE SIGNATURE from REAL scraped data. Reality first; goal_intent is only a tie-break lens, never the source. Map the audience onto the FIXED 10 archetypes (below) — fill ALL 10, shares sum to 1.0. Derive temperature_mix + dispositions + weights from the engagement RATIOS; never invent counts or demographics. creator_persona.voice comes from the transcript/caption + watchNotes.
Each persona keeps its fixed archetype slug, but MAKE IT SPECIFIC TO THIS CREATOR — not a generic template: give it a display_name (a concrete human label for how THIS creator's audience actually shows up, e.g. "Frame-by-frame editors" — never the raw archetype word), a one-line blurb in that viewer's voice, and scored reaction+behavior axes (every value 0..1) that FOLLOW from the real engagement data. Also emit topic_vocab: 8-14 lowercase_snake tags mixing this niche's subjects WITH cross-cutting appeal registers (spectacle, humor, relatable, transformation, satisfying, educational). Each persona's reaction.interests references ONLY topic_vocab tags — only the ones that segment truly cares about. Spread the 10 across the axes (a lurker and a niche_deep_buyer are opposites, not neighbours), but keep them TRUE to this creator. Return ONLY JSON matching this schema, no preamble:
{
  "creator_persona": { "content_description": "<niche, 1 line>", "context": "<audience · voice · formats · expertise · AVOID>", "writing_style_sample": "<verbatim transcript/caption of the top video>", "format_signature": "<video format/style from watchNotes>" },
  "audience": {
    "follower_tier": "new|small|mid|large|mega|null",
    "maturity": "new|growing|established",
    "temperature_mix": { "cold": 0.0, "warm": 0.0, "hot": 0.0 },
    "interest_tags": ["..."],
    "topic_vocab": ["<niche subject or appeal register, lowercase_snake>"],
    "what_resonates": "<from winners + watchNotes>",
    "what_falls_flat": "<from low-engagement videos>",
    "persona_weights": { "fyp":0.0,"niche":0.0,"loyalist":0.0,"cross_niche":0.0 },
    "personas": [ { "archetype":"<slug>","share":0.0,"display_name":"<creator-specific label>","blurb":"<one line in this viewer's voice>","reaction_frame":"<how THIS audience's segment judges content>","evidence":"<engagement-ratio proof>","reaction":{"interests":{"<topic_vocab tag>":0.0},"hookSensitivity":0.0,"noveltyBias":0.0,"skepticism":0.0,"attentionSpan":0.0},"behavior":{"watchThrough":0.0,"sharePropensity":0.0,"commentPropensity":0.0,"savePropensity":0.0} } ]
  },
  "summary": "<reveal-screen copy, 1-2 sentences>"
}
temperature_mix sums to 1.0. persona_weights sums to 1.0. EXACTLY 10 personas, shares sum to 1.0, one per slug. Every reaction/behavior axis in [0,1]; interests keys come only from topic_vocab.
FIXED ARCHETYPES (archetype | temperature | disposition | weight-slot):
 tough_crowd|cold|skeptic|fyp · lurker|cold|lurker|fyp · high_engager|warm|connector|fyp · saver|warm|collector|fyp · sharer|warm|connector|fyp · purposeful_viewer|warm|scanner|niche · niche_deep_buyer|hot|converter|niche · niche_deep_scout|hot|skeptic|niche · loyalist|hot|connector|loyalist · cross_niche_curiosity|cold|scanner|cross_niche`;

// ─── Engagement scoring + selection ──────────────────────────────────────────────

/** Engagement weight = saveRate + shareRate (the §P.13 "top performers" lever). */
function engagementScore(v: VideoData): number {
  const plays = v.views > 0 ? v.views : 1;
  return (v.saves + v.shares) / plays;
}

/** Top N videos by engagement (N in [MIN_WATCH, MAX_WATCH], clamped to available). */
export function selectTopVideos(videos: VideoData[]): VideoData[] {
  const ranked = [...videos].sort((a, b) => engagementScore(b) - engagementScore(a));
  const n = Math.min(MAX_WATCH, Math.max(MIN_WATCH, Math.min(ranked.length, MAX_WATCH)));
  return ranked.slice(0, Math.min(n, ranked.length));
}

// ─── VTT → plain text ────────────────────────────────────────────────────────────

/** Strip WEBVTT cues (timestamps, indices, tags) to plain transcript text. */
export function vttToText(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "WEBVTT" || line.startsWith("NOTE")) continue;
    if (/^\d+$/.test(line)) continue; // cue index
    if (line.includes("-->")) continue; // timestamp
    out.push(line.replace(/<[^>]+>/g, "")); // strip inline tags
  }
  // De-dup consecutive identical lines (TikTok VTT often repeats rolling captions).
  const dedup: string[] = [];
  for (const l of out) if (l !== dedup[dedup.length - 1]) dedup.push(l);
  return dedup.join(" ").slice(0, SUBTITLE_MAX_CHARS);
}

// ─── Injectable deps ─────────────────────────────────────────────────────────────

/**
 * The two phases of enrichment, announced as they BEGIN. Only this module can see the
 * boundary — the caller awaits one opaque promise (see `onStage` in CalibrationDeps).
 */
export type EnrichStage = "watching" | "synthesizing";

export interface EnrichDeps {
  /** Watch one mp4 with omni-flash → WatchNote (default: real DashScope call). */
  watchVideo?: (mp4Url: string, ctx: string) => Promise<WatchNote | null>;
  /** Fetch a subtitle URL → plain text (default: real no-auth fetch + VTT strip). */
  fetchSubtitle?: (url: string) => Promise<string | null>;
  /** Synthesize the signature from the payload → validated SynthSchema shape. */
  synthesize?: (payload: SynthPayload) => Promise<z.infer<typeof SynthSchema>>;
  /** Fired as each phase STARTS, so a 2-minute run can report what it is actually doing. */
  onStage?: (stage: EnrichStage) => void;
}

export interface EnrichInput {
  handle: string;
  profile: ProfileData;
  videos: VideoData[];
  subCoverage: string;
  goalIntent: GoalIntent;
}

export interface SynthPayload {
  handle: string;
  accountStats: {
    fans: number;
    heart: number;
    video: number;
    verified: boolean;
    bio: string;
    region?: string;
  };
  videos: Array<{
    play: number;
    like: number;
    comment: number;
    share: number;
    save: number;
    saveRate: number;
    shareRate: number;
    dur: number;
    caption: string;
    subtitleText?: string;
  }>;
  watchNotes: WatchNote[];
  goalIntent: GoalIntent;
}

// ─── mp4 URL prep (SSRF allowlist + Apify token) ─────────────────────────────────

/** Hosts a scraped mp4 may live on (Apify KV record or TikTok CDN fallback). */
const MP4_HOST_SUFFIXES = [".apify.com", ".apifyusercontent.com", ".tiktokcdn.com", ".tiktokcdn-us.com"];

/**
 * Validate a scraped `mediaUrl` and make it omni-fetchable. The mp4 is a PRIVATE Apify
 * KV-store record — DashScope GETs it directly, so it needs the Apify token appended (P.13;
 * without `?token=` the omni call 400s "Failed to download multimodal content"). Returns
 * null for non-HTTPS / non-allowlisted hosts (SSRF guard) → that video is skipped.
 */
export function prepareWatchUrl(mediaUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(mediaUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname;
  const allowed = MP4_HOST_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
  if (!allowed) return null;
  const token = process.env.APIFY_TOKEN;
  if (token && /(^|\.)apify\.com$/.test(host) && !u.searchParams.has("token")) {
    u.searchParams.set("token", token);
  }
  return u.toString();
}

// ─── Real default deps ───────────────────────────────────────────────────────────

async function defaultWatchVideo(mp4Url: string, ctx: string): Promise<WatchNote | null> {
  const ai = getQwenClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OMNI_TIMEOUT_MS);
  try {
    const completion = await ai.chat.completions.create(
      {
        model: QWEN_OMNI_MODEL,
        messages: [
          { role: "system", content: WATCH_SYSTEM },
          {
            role: "user",
            content: [
              { type: "video_url" as never, video_url: { url: mp4Url } } as never,
              { type: "text", text: `${ctx} Analyze.` },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
        max_tokens: 600,
      },
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = WatchNoteSchema.safeParse(JSON.parse(stripModelOutput(raw)));
    if (!parsed.success) {
      log.warn("omni watch zod failed", { error: parsed.error.message });
      return null;
    }
    log.info("omni watch ok", { cost_cents: calculateCost(QWEN_OMNI_MODEL, completion.usage ?? undefined) });
    return parsed.data;
  } catch (err) {
    log.warn("omni watch failed", { error: String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function defaultFetchSubtitle(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBTITLE_FETCH_TIMEOUT_MS);
  try {
    if (!url.startsWith("https://")) return null; // no-auth tiktokLink is always https
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    return vttToText(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function defaultSynthesize(payload: SynthPayload): Promise<z.infer<typeof SynthSchema>> {
  const ai = getQwenClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS);
  try {
    const completion = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL, // CALIBRATE: bake-once — D-01: greedy temp:0, thinking-mode OFF
        messages: [
          { role: "system", content: SYNTH_SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
        max_tokens: SYNTH_MAX_TOKENS, // 8000: v2 persona output (~3.5k) + headroom (thinking budget dropped per D-01)
        enable_thinking: false,       // D-01: greedy temp:0 is the determinism lever; thinking-mode staging was the Pitfall-3 residual-jitter source (spike 02-02 NON-DETERMINISTIC)
      } as never,
      { signal: controller.signal },
    );
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = SynthSchema.safeParse(JSON.parse(stripModelOutput(raw)));
    if (!parsed.success) {
      throw new Error(`signature synthesis validation failed: ${parsed.error.message}`);
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────────

/**
 * Enrich a scraped profile bundle into the frozen AudienceSignature.
 *
 * Pipeline (all calibration-only, deterministic):
 *   1. Select top 3-5 videos by engagement.
 *   2. Watch each (omni-flash) + fetch their native subtitles (free) — in parallel.
 *   3. Synthesize the signature (one flash text call) from stats + engagement + subs + notes.
 *   4. Engine-fill each reactor's temperature/disposition from the canonical map, attach
 *      derived provenance. Output is frozen on the row.
 *
 * Throws on synthesis failure (caller maps to a calibration error). Watch/subtitle failures
 * degrade gracefully (the signature is still built from stats + engagement).
 */
export async function enrichSignature(
  input: EnrichInput,
  deps: EnrichDeps = {},
): Promise<AudienceSignature> {
  const { handle, profile, videos, subCoverage, goalIntent } = input;
  const watchVideo = deps.watchVideo ?? defaultWatchVideo;
  const fetchSubtitle = deps.fetchSubtitle ?? defaultFetchSubtitle;
  const synthesize = deps.synthesize ?? defaultSynthesize;
  const onStage = deps.onStage;

  const top = selectTopVideos(videos);

  // The omni watch is the long pole here (N video calls, 60s timeout each) — say so.
  onStage?.("watching");

  // ── Watch the top videos directly from the bundle mp4 (no rehost), parallel, fail→null ──
  // `mediaUrl` is the downloaded Apify KV record from the single bundle scrape; prepareWatchUrl
  // SSRF-checks it and appends the Apify token. Videos with no mediaUrl are skipped.
  const watchNotes = (
    await Promise.all(
      top.map(async (v) => {
        try {
          const mp4 = v.mediaUrl ? prepareWatchUrl(v.mediaUrl) : null;
          if (!mp4) return null;
          const plays = v.views > 0 ? v.views : 1;
          const ctx = `Engagement: plays=${v.views} saves=${v.saves} shares=${v.shares} (saveRate ${((v.saves / plays) * 100).toFixed(2)}%, shareRate ${((v.shares / plays) * 100).toFixed(2)}%).`;
          return await watchVideo(mp4, ctx);
        } catch (err) {
          log.warn("watch pipeline failed for video", { id: v.platformVideoId, error: String(err) });
          return null;
        }
      }),
    )
  ).filter((n): n is WatchNote => n !== null);

  // ── Fetch native subtitles for the watched set (free, no-auth tiktokLink) ─────────
  const transcriptTargets = top.filter((v) => v.subtitleUrl).slice(0, MAX_TRANSCRIPTS);
  const transcripts = new Map<string, string>();
  await Promise.all(
    transcriptTargets.map(async (v) => {
      const text = v.subtitleUrl ? await fetchSubtitle(v.subtitleUrl) : null;
      if (text) transcripts.set(v.platformVideoId, text);
    }),
  );

  // ── Build the synthesis payload (stats + engagement + subs + notes) ──────────────
  const payload: SynthPayload = {
    handle,
    accountStats: {
      fans: profile.followerCount,
      heart: profile.heartCount,
      video: profile.videoCount,
      verified: profile.verified,
      bio: profile.bio,
    },
    videos: videos.map((v) => {
      const plays = v.views > 0 ? v.views : 1;
      return {
        play: v.views,
        like: v.likes,
        comment: v.comments,
        share: v.shares,
        save: v.saves,
        saveRate: Number(((v.saves / plays) * 100).toFixed(3)),
        shareRate: Number(((v.shares / plays) * 100).toFixed(3)),
        dur: v.durationSeconds,
        caption: v.caption,
        ...(transcripts.has(v.platformVideoId)
          ? { subtitleText: transcripts.get(v.platformVideoId) }
          : {}),
      };
    }),
    watchNotes,
    goalIntent,
  };

  onStage?.("synthesizing");
  const synth = await synthesize(payload);

  // ── Engine-fill temperature/disposition from the canonical map (engine truth) ─────
  const personas: SignaturePersona[] = synth.audience.personas.map((p) => {
    const label = TEMPERATURE_DISPOSITION[p.archetype as keyof typeof TEMPERATURE_DISPOSITION];
    return {
      archetype: p.archetype as SignaturePersona["archetype"],
      share: p.share,
      temperature: label.temperature,
      disposition: label.disposition,
      reaction_frame: p.reaction_frame,
      evidence: p.evidence,
      // v2: carry the custom identity + scored axes when the model supplied them (legacy-safe:
      // omit empties so old-shape consumers/tests see no change).
      ...(p.display_name ? { display_name: p.display_name } : {}),
      ...(p.blurb ? { blurb: p.blurb } : {}),
      ...(p.reaction ? { reaction: p.reaction } : {}),
      ...(p.behavior ? { behavior: p.behavior } : {}),
    };
  });

  const signature: AudienceSignature = {
    creator_persona: synth.creator_persona,
    audience: {
      follower_tier: synth.audience.follower_tier,
      maturity: synth.audience.maturity,
      temperature_mix: synth.audience.temperature_mix,
      interest_tags: synth.audience.interest_tags,
      what_resonates: synth.audience.what_resonates,
      what_falls_flat: synth.audience.what_falls_flat,
      persona_weights: synth.audience.persona_weights,
      personas,
      ...(synth.audience.topic_vocab?.length ? { topic_vocab: synth.audience.topic_vocab } : {}),
    },
    summary: synth.summary,
    provenance: {
      handle,
      scraped_at: new Date().toISOString(),
      videos_analyzed: videos.length,
      videos_watched: watchNotes.length,
      sub_coverage: subCoverage,
    },
  };

  Sentry.addBreadcrumb({
    category: "audience.enrich",
    message: "signature built",
    data: { handle, videos: videos.length, watched: watchNotes.length, transcripts: transcripts.size },
  });

  return signature;
}

/** Internal slot map exported for the resolver/test surface (archetype → weight slot). */
export { SLOT_BY_ARCHETYPE };
