// D-17 (Phase 13 Plan 03): NICHE_SYSTEM_PROMPT and buildNicheUserMessage removed.
// Niche detection is now folded into the Gemini content-type call in content-type-detector.ts.
// tryUrlHost helper below is reused by wave3/persona-prompts.ts.

// PROFILE-16 helper — host-only extraction; never surface full URLs in LLM prompt
export function tryUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
