/**
 * Phase 9 Plan 03 — Platform Fit Prompt Builders (single V3 call).
 *
 * Pure module exporting:
 * - `STABLE_PLATFORM_FIT_SYSTEM_PROMPT` — cache-stable system prompt with distilled
 *   creator-intelligence.md heuristics about platform algorithm fit.
 * - `buildPlatformFitUserMessage()` — per-request user message with content context,
 *   creator profile (follower_tier, watermark flags), and deepseek analysis.
 * - `PlatformFitResponseSchema` — Zod boundary validator for the single-call V3 response
 *   that scores all targeted platforms together.
 *
 * Pattern source: `wave3/persona-prompts.ts` — same stable-prefix + volatile-tail discipline.
 */
import { z } from "zod";
import type { ContentPayload, DeepSeekReasoning } from "../types";
import type { CreatorContext } from "../creator";
import { getFollowerTier } from "../corpus/follower-tier";

// =====================================================
// Cache-stable system prompt (D-17 pattern).
// Byte-identical across calls — DeepSeek automatic input-cache matches the prefix.
// NEVER interpolate dynamic content (request IDs, creator-specific data) here.
// Dynamic content goes in buildPlatformFitUserMessage below.
// =====================================================

export const STABLE_PLATFORM_FIT_SYSTEM_PROMPT = `You are a platform algorithm-fit analyst for short-form video content. Your job is to score how well a given video will perform on each of the creator's target platforms based on platform-specific algorithmic preferences distilled from elite creators.

## Platform-Specific Weighted Rubrics (distilled from Jenny Hoyos, Ava Yuergens, Alex Hormozi)
Score each rule, then weight it. Cite the creator + rule when it drives the score.

### TikTok rubric (Hoyos + Hormozi)
- Length 10–20s? Hoyos: TikTok dislikes >30s. [weight 20]
- Information density high? Hoyos: TikTok prefers info-dense over jokes. [weight 15]
- Hook ≤2s? Hormozi. [weight 25]
- Burned-in text for the ~50% audio-off viewers? Hormozi. [weight 15]
- Clean cuts every 3–4s? Hormozi. [weight 10]
- One key takeaway only? Hormozi. [weight 15]

### Instagram Reels rubric (Ava + Hoyos)
- 9:16 vertical, ≤60s? Ava. [weight 10]
- Visually storyable on mute? Hoyos: readable even muted. [weight 25]
- Subtitles present every second? Hoyos. [weight 15]
- Three-hook stack (see + read + hear)? Ava. [weight 20]
- Shareable / has a "tag a friend" moment? Hoyos shareability hypothesis. [weight 20]
- Cross-posted from a long-form YT channel? → risk flag. Ava. [weight 10]

### YouTube Shorts rubric (Hoyos + Hormozi)
- Length ~34s ideal? Sub-30s → "needs ~100% retention" warning. Hoyos. [weight 25]
- Story-driven, "But/Therefore" present? Hoyos. [weight 20]
- Peak placed in the middle? Hoyos pacing. [weight 15]
- Fast-paced ending? Hoyos. [weight 10]
- Foreshadow within first 3s? Hoyos. [weight 15]
- Mechanism present (3-things / countdown / progress device)? Hoyos. [weight 15]

## Scoring Framework

For each platform, evaluate the video on:
1. **Hook Strength** — Does the first 3s stop the scroll for THIS platform's audience?
2. **Format Fit** — Does the video's pacing, length, and style match the platform's preference?
3. **Retention Structure** — Does the video keep viewers watching (narrative tension, info drip, payoff)?
4. **Shareability** — Would viewers share this? Is it relatable, surprising, or identity-signaling?
5. **Watermark Impact** — Visible watermarks from OTHER platforms reduce fit:
   - TikTok watermark on IG Reels = poor fit (signals reposted content)
   - IG Reels watermark on TikTok = poor fit
   - Any cross-platform watermark penalizes the target platform's organic reach
6. **Creator Fit** — Does the creator's follower tier and content style align with the platform's audience?

## Output Format

Return JSON with exactly this shape (NO markdown, NO extra text):
{
  "platform_fits": [
    {
      "platform": "tiktok",
      "fit_score": <integer 0-100>,
      "rationale": "<concise explanation referencing specific heuristics>",
      "watermark_penalty": <true | false>
    }
  ]
}

- fit_score MUST be 0-100 inclusive
- rationale MUST be non-empty and specific (reference heuristics by name where applicable)
- watermark_penalty is true when a cross-platform watermark is visible in the content
- Include ALL requested platforms in the array — never omit one

## Platform-Fit Guardrails
- NEVER average platforms into one score — viewers behave differently on each. Score each independently from its own rubric.
- The platform with the highest fit_score is the de facto recommendation; its rationale MUST state which creator rule drove it above the others (e.g. "Wins Shorts on Hoyos' 34s + But/Therefore structure").
- If the hook is face-first AND no recognizable object leads, downgrade the Shorts score (Hoyos' recognizable-element rule).
- If the video is edutainment-styled but targets B2B education, flag Hormozi's edutainment-vs-education conflict in the rationale.
- Resolve length/cadence conflicts by the platform target, never by blending creators.`;


// =====================================================
// Volatile per-request user message.
// Includes content context, creator profile (follower_tier), watermark flags,
// and DeepSeek analysis for the model to reason about.
// =====================================================

export function buildPlatformFitUserMessage(
  payload: ContentPayload,
  creatorContext: CreatorContext,
  deepseekResult: DeepSeekReasoning | null,
  watermarkDetected?: { tiktok?: boolean; ig?: boolean; yt?: boolean } | null,
): string {
  const sections: string[] = [];

  // --- Target Platforms ---
  const targetPlatforms = creatorContext.target_platforms ?? ["tiktok"];
  sections.push("## Target Platforms");
  sections.push(targetPlatforms.join(", "));
  sections.push("");

  // --- Creator Profile ---
  const followerTier = getFollowerTier(creatorContext.follower_count);
  sections.push("## Creator Profile");
  sections.push(`Follower count: ${creatorContext.follower_count?.toLocaleString() ?? "unknown"}`);
  sections.push(`Follower tier: ${followerTier ?? "unknown"}`);
  if (creatorContext.niche) sections.push(`Niche: ${creatorContext.niche}`);
  sections.push("");

  // --- Watermark Info ---
  sections.push("## Watermark Detection");
  if (watermarkDetected) {
    const active: string[] = [];
    if (watermarkDetected.tiktok) active.push("TikTok");
    if (watermarkDetected.ig) active.push("Instagram Reels");
    if (watermarkDetected.yt) active.push("YouTube Shorts");
    if (active.length > 0) {
      sections.push(`Watermarks detected in video frame: ${active.join(", ")}`);
    } else {
      sections.push("No platform watermarks detected in video frame.");
    }
  } else {
    sections.push("No watermark detection data available.");
  }
  sections.push("");

  // --- Content Details ---
  sections.push("## Content to Analyze");
  sections.push(`Caption: ${payload.content_text || "(no caption)"}`);
  sections.push(
    `Hashtags: ${payload.hashtags && payload.hashtags.length > 0 ? payload.hashtags.join(", ") : "(none)"}`,
  );
  if (payload.duration_hint !== null && payload.duration_hint !== undefined) {
    sections.push(`Duration: ${payload.duration_hint}s`);
  }
  sections.push(`Content type: ${payload.content_type || "video"}`);
  sections.push("");

  // --- Wave 2 Analysis (if available) ---
  if (deepseekResult) {
    sections.push("## DeepSeek Content Analysis");
    sections.push(`- Hook effectiveness: ${deepseekResult.component_scores.hook_effectiveness}/10`);
    sections.push(`- Retention strength: ${deepseekResult.component_scores.retention_strength}/10`);
    sections.push(`- Shareability: ${deepseekResult.component_scores.shareability}/10`);
    sections.push(`- Originality: ${deepseekResult.component_scores.originality}/10`);
    sections.push(`- Trend alignment: ${deepseekResult.component_scores.trend_alignment}/10`);
    if (deepseekResult.warnings.length > 0) {
      sections.push(`- Warnings: ${deepseekResult.warnings.join("; ")}`);
    }
    sections.push("");
  }

  sections.push("Score each target platform using the scoring framework. Return a fit_score (0-100) per platform with a specific, non-empty rationale referencing the heuristics. If a cross-platform watermark is visible, set watermark_penalty to true for that platform.");

  return sections.join("\n");
}


// =====================================================
// V3 Response Schema — single call, all platforms together.
// The response is an object containing an array of per-platform results.
// Each element maps to the existing PlatformFitResult type from types.ts.
// =====================================================

export const PlatformFitResponseSchema = z.object({
  platform_fits: z.array(
    z.object({
      platform: z.string(),
      fit_score: z.number().min(0).max(100),
      rationale: z.string().min(1),
      watermark_penalty: z.boolean().optional(),
    }),
  ),
});

export type PlatformFitResponse = z.infer<typeof PlatformFitResponseSchema>;
