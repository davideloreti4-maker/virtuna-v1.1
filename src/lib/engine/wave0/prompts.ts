import { NICHE_TREE } from "@/lib/niches/taxonomy";
import type { ContentPayload } from "../types";
import type { CreatorContext } from "../creator";

// =====================================================
// STABLE system prompt — byte-identical across calls (Phase 3 D-12 + Pitfall 2/3).
// NICHE_TREE inlining resolved at MODULE LOAD; still byte-identical per-request.
// Dynamic content (caption, hashtags, handle, Card data) goes EXCLUSIVELY
// in the user message — never in this prompt.
// =====================================================

const PRIMARY_SLUGS = NICHE_TREE.map((p) => p.slug).join(", ");
const NICHE_TREE_TEXT = NICHE_TREE
  .map((p) => `- ${p.slug}: ${p.subs.map((s) => s.slug).join(", ")}`)
  .join("\n");

export const NICHE_SYSTEM_PROMPT = `You are a TikTok content niche classifier. Classify the provided content into the taxonomy.

## Taxonomy (only return slugs from this list)

Primary slugs: ${PRIMARY_SLUGS}

Sub-slugs by primary:
${NICHE_TREE_TEXT}

## Output

Return JSON with this exact shape:

{
  "primary": "<slug from primary list>",
  "sub": "<slug from sub list under primary>",
  "micro": "<more specific sub-niche slug OR null if uncertain>",
  "confidence": <0.0-1.0 overall confidence>,
  "micro_confidence": <0.0-1.0 confidence in the micro field specifically>
}

## Rules

- ONLY return slugs from the taxonomy above. NEVER invent new slugs.
- If the content doesn't fit any niche well, choose the closest primary + sub anyway. Don't refuse to classify.
- Confidence should reflect how clearly the content matches the chosen niche.
- micro can be more granular than the listed sub-slugs (e.g., "skincare-routine-morning" for skincare). It must be a slug format (lowercase, hyphen-separated). Return null if uncertain — the system handles micro=null gracefully.
- The creator profile (Card 1 niche, Card 4 content style, Card 5 reference creators, Card 6 past wins) is provided as context but is NOT authoritative — the per-video signal in caption/hashtags is more accurate for THIS video than the static profile.

Return ONLY the JSON object. No explanation, no markdown.`;

// =====================================================
// VOLATILE user message — per-request dynamic content.
// PROFILE-16 mitigation: past_wins/past_flops URLs are HOST-ONLY.
// =====================================================

export function buildNicheUserMessage(
  payload: ContentPayload,
  ctx: CreatorContext,
): string {
  const sections: string[] = ["## Content to Classify"];

  sections.push("Caption / content text:");
  sections.push(payload.content_text || "(no caption)");
  sections.push("");
  sections.push(
    `Hashtags: ${payload.hashtags && payload.hashtags.length > 0 ? payload.hashtags.join(", ") : "(none)"}`,
  );
  if (payload.creator_handle) {
    sections.push(`Creator handle: @${payload.creator_handle}`);
  }

  sections.push("");
  sections.push("## Creator Profile Context (advisory, not authoritative)");

  if (ctx.niche_primary) {
    const sub = ctx.niche_sub ? `/${ctx.niche_sub}` : "";
    sections.push(`Card 1 (self-reported niche): ${ctx.niche_primary}${sub}`);
  }
  if (ctx.content_style) {
    sections.push(`Card 4 (content style): ${ctx.content_style}`);
  }
  if (ctx.reference_creators && ctx.reference_creators.length > 0) {
    const handles = ctx.reference_creators
      .map((r) => extractHandleOrHost(r.handle_or_url))
      .filter(Boolean)
      .join(", ");
    if (handles) sections.push(`Card 5 (reference creator handles): ${handles}`);
  }
  if (ctx.past_wins && ctx.past_wins.length > 0) {
    const hosts = ctx.past_wins
      .map((w) => tryUrlHost(w.url))
      .filter(Boolean)
      .join(", ");
    if (hosts) sections.push(`Card 6 (past wins hosts): ${hosts}`);
  }

  sections.push("");
  sections.push("Return the classification JSON now.");
  return sections.join("\n");
}

// PROFILE-16 helpers — host-only extraction; never surface full URLs in LLM prompt
function extractHandleOrHost(s: string): string {
  const m = s.match(/@([a-zA-Z0-9._]+)/);
  if (m && m[1]) return `@${m[1]}`;
  try {
    return new URL(s).host;
  } catch {
    return s.trim();
  }
}

export function tryUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
