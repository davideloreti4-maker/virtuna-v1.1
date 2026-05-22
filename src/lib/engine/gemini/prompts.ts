/**
 * Phase 5 — Per-segment prompt builders.
 *
 * Stable-prefix / volatile-suffix discipline (AI-SPEC §4b lines 753-790):
 *   • System prompt: cacheable, byte-identical across calls (the rubric + calibration baselines).
 *   • User prompt: per-request context (niche, content_type, creator style, segment scope).
 *
 * NO few-shot examples — refines rubric language instead (RESEARCH line 450).
 * NO calibration data in the user prompt (kills any future cache hit rate).
 */

import type { CalibrationData } from "../gemini";
import type { ContentTypeSlug } from "../types";

export interface SegmentedPromptOptions {
  calibration: CalibrationData;
  niche?: string | null;
  contentType?: ContentTypeSlug | null;
  creatorStyle?: string | null;     // Card 4 — optional injection per D-15
}

// =======================
// HOOK PROMPT (D-04, D-15)
// =======================
function buildHookSystemPrompt(calibration: CalibrationData): string {
  const topDifferentiators = [...calibration.viral_vs_average.differentiators]
    .sort((a, b) => Math.abs(b.difference_pct) - Math.abs(a.difference_pct))
    .slice(0, 3);

  return `You are a TikTok hook decomposition expert. Score the FIRST 5 SECONDS of a vertical video across 5 viral factors AND 4 sub-modalities, then identify the weakest modality and score cross-modal coherence + cognitive load.

## The 5 TikTok Factors (score 0-10, hook-scope only)
1. **Scroll-Stop Power** — would a user stop scrolling in the first 0.5-1s?
2. **Completion Pull** — does the hook promise something the body will pay off?
3. **Rewatch Potential** — does the hook reward a second view?
4. **Share Trigger** — does the hook trigger "tag someone"?
5. **Emotional Charge** — does the hook evoke an intense feeling in 5s?

## The 4 Sub-Modality Scores (score 0-10 each)
- **visual_stop_power** — does the first frame physically arrest attention?
- **audio_hook_quality** — is the first 5s audio stop-worthy (trending sound, energy, beat-cut, silence-then-bang)?
- **text_overlay_score** — does on-screen text (if any) create curiosity? (Distinguish CONTENT text from brand-watermark — score brand chrome at 0.)
- **first_words_speech_score** — does the opening spoken/captioned line promise something specific within ~2 seconds?

## Weakest Modality (presence-aware!)
Return the SUB-MODALITY name (one of: visual_stop_power / audio_hook_quality / text_overlay_score / first_words_speech_score) that is the lowest-scoring AND PRESENT in the hook.
**CRITICAL: If a modality is genuinely absent from the hook (e.g. no on-screen text, no spoken words), score it at 0 AND mention this in the rationale, AND do NOT name it as weakest_modality.** Pick from the modalities that are actually present.

## Cross-Modal Scores (score 0-10 each)
- **visual_audio_coherence** — do visual and audio say the same thing (mood match, beat-cut alignment, lip-sync)?
- **cognitive_load** — information density per second. **POLARITY: HIGHER = WORSE.** A score of 9 means the hook is too much to process; a score of 2 means one clear idea per second.

## Watermark Detection
Flag visible platform watermarks in the hook frame (first 5s). Set watermarks booleans:
- **tiktok**: TikTok logo/watermark visible in frame.
- **ig**: Instagram or Reels watermark visible.
- **yt**: YouTube Shorts watermark visible.

**Negative examples — do NOT flag these as watermarks:**
- Creator's own handle/username overlay (this is content, not a platform mark).
- Brand logos, sponsored tags, or product placements.
- Text overlays that are part of the creative (caption, subtitle, sticker).
- Generic UI chrome (volume slider, progress bar, phone notch).
- Reposted content from another platform that has been re-uploaded (only flag platform watermarks embedded by the hosting platform during upload).

**If no platform watermark is visible, set all three to false or omit the field.** The field is optional — only populate when confident.

## Scoring Rules
- Score 0.0-10.0 with one decimal precision.
- Use ABSOLUTE scoring (universal quality standards), NOT niche-relative.
- Most content scores 4-7; above 8 is exceptional.
- Each factor needs: score + rationale (1-2 sentences, max 20 words each) + improvement_tip (max 20 words). Keep all strings short.
- **temporal grounding**: every rationale MUST reference only events visible/audible in the FIRST 5 SECONDS. Do NOT reference content from later in the video.

## Calibration Data (from 7,321 analyzed TikTok videos)
- Viral share rate threshold (p90): ${calibration.primary_kpis.share_rate.viral_threshold}
- Viral weighted engagement score (p90): ${calibration.primary_kpis.weighted_engagement_score.percentiles.p90}
- Duration sweet spot: ${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[0]}-${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[1]}s
- Top viral differentiators:
${topDifferentiators.map((d) => `  - ${d.factor}: ${d.description}`).join("\n")}

Return JSON matching the schema exactly.`;
}

export function buildHookPrompt(opts: SegmentedPromptOptions): string {
  const system = buildHookSystemPrompt(opts.calibration);
  const niche = opts.niche ? `Niche: ${opts.niche}` : "";
  const contentType = opts.contentType ? `Content type: ${opts.contentType}` : "";
  const creatorStyle = opts.creatorStyle ? `Creator style preference: ${opts.creatorStyle}` : "";
  const userMessage = [
    niche,
    contentType,
    creatorStyle,
    "",
    "Analyze ONLY the 0-5s hook of this video. Score each of the 5 factors AND each of the 4 sub-modalities (visual_stop_power, audio_hook_quality, text_overlay_score, first_words_speech_score). Then name the WEAKEST of the four sub-modalities (presence-aware). Then score visual_audio_coherence and cognitive_load.",
  ].filter(Boolean).join("\n");
  return `${system}\n\n---\n\n${userMessage}`;
}

// =======================
// BODY PROMPT (D-15)
// =======================
function buildBodySystemPrompt(_calibration: CalibrationData): string {
  return `You are a TikTok video body analyst. Evaluate the MIDDLE section of a vertical video (5s through end-3s) on 3 production signals.

## Body video_signals (score 0-10 each)
- **visual_production_quality** — lighting, framing, subject in 9:16 safe-zone, audio not clipping. AUTHENTIC low-fi is fine; INCOMPETENT is not. Do NOT down-score authentic creator content for being unpolished.
- **pacing_score** — editing rhythm in the body window. Three-beat rule (major change every 3-4s). Static talking-head with no rhythm scores low; over-cut fragmentation also scores low.
- **transition_quality** — motion-matched cuts, beat-cuts on downbeats, J/L cuts. Hard cuts to unrelated material score low.

## Scoring Rules
- Score 0.0-10.0 with one decimal precision.
- Use ABSOLUTE scoring (universal quality standards).
- Most content scores 4-7.

Return JSON matching the schema exactly.`;
}

export function buildBodyPrompt(opts: SegmentedPromptOptions): string {
  const system = buildBodySystemPrompt(opts.calibration);
  const niche = opts.niche ? `Niche: ${opts.niche}` : "";
  const contentType = opts.contentType
    ? `Content type: ${opts.contentType} (use this to weight pacing/transitions appropriately — slideshow needs less pacing, tutorial needs methodical rhythm).`
    : "";
  const userMessage = [
    niche,
    contentType,
    "",
    "Analyze ONLY the body section (5s through end-3s) of this video. Score the 3 video_signals and provide a 1-2 sentence body_summary.",
  ].filter(Boolean).join("\n");
  return `${system}\n\n---\n\n${userMessage}`;
}

// =======================
// CTA PROMPT (D-05, D-06, D-07, D-15)
// =======================
function buildCtaSystemPrompt(): string {
  return `You are a TikTok CTA presence detector. Examine the LAST 3 SECONDS of a vertical video and determine whether the creator issued a call-to-action.

## What counts as a CTA (cta_present=true)
- Creator verbally invites a specific action ("follow for more", "comment your favorite", "link in bio")
- On-screen text in the last 3s invites action ("save this", "share with a friend")
- A caption-CTA that is SURFACED via on-screen text in the last 3s

## What does NOT count as a CTA (cta_present=false)
- TikTok-native "Follow" button (platform UI, not creator CTA)
- End-card watermark / logo
- Generic sign-off ("see you next time") without an action request
- A caption-only CTA that is NOT surfaced on screen during the last 3s

## When cta_present=true, ALSO return:
- **strength** (0-10): how well-executed is the CTA? Single clear CTA scores high; "follow AND comment AND tap link" scores low.
- **type**: one of follow / comment / link_in_bio / watch_next / engage_question / other

## When cta_present=false, set strength=null AND type=null. Rationale: explain WHY no CTA is detected.

## Rationale (1-2 sentences)
- If present: WHAT the CTA is + WHY this strength score.
- If absent: WHY no CTA is detected (e.g., "No call-to-action detected — typical for comedy content").

Return JSON matching the schema exactly. CRITICAL: cta_present is the discriminator — when false, strength + type MUST both be null.`;
}

export function buildCtaPrompt(opts: SegmentedPromptOptions): string {
  const system = buildCtaSystemPrompt();
  const niche = opts.niche ? `Niche: ${opts.niche}` : "";
  const contentType = opts.contentType
    ? `Content type: ${opts.contentType} (tutorial/b_roll: CTA expected; comedy/vlog/talking_head: optional).`
    : "";
  const userMessage = [
    niche,
    contentType,
    "",
    "Analyze ONLY the LAST 3 SECONDS of this video. Determine cta_present (boolean discriminator). If true, score strength + type. If false, leave both null.",
  ].filter(Boolean).join("\n");
  return `${system}\n\n---\n\n${userMessage}`;
}
