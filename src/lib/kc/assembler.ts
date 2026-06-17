/**
 * assembler.ts — Per-request live-tier grounding assembler (GROUND-02 / D-05).
 *
 * ARCHITECTURAL SPLIT (resolves RESEARCH A4 ambiguity):
 * ─────────────────────────────────────────────────────
 * The Phase-1 ToolRunner field `knowledgeBundle` on the static runner const is the
 * STATIC SLICE-BINDING — it identifies which compiled KC slice this tool uses (a
 * build-time, module-level constant). It is NOT the live grounding.
 *
 * THIS MODULE produces the PER-REQUEST LIVE GROUNDING — the VOLATILE USER MESSAGE
 * that feeds the Qwen call alongside the byte-stable cached system prompt (KC_<MODE>_SYSTEM_PROMPT).
 * It is a function, not a static value. Never mutate the module-level runner const with
 * per-request output (Pitfall #4, shared mutable state).
 *
 * Data flow:
 *   assembleBundle(input, profileRow)
 *     → per-mode field-map pull (only MODE_ROLES[mode] roles)
 *     → hard length cap (BUNDLE_CHAR_CAP) with lowest-priority role drop
 *     → cold-start / thin-profile honest flag (never fabricated)
 *     → <<<USER_CONTENT>>> fence + sentinel-strip on ask/overrides/anchor
 *     → returns the volatile user message string
 *
 *   Qwen call:
 *     system = KC_<MODE>_SYSTEM_PROMPT  (byte-stable, warm Qwen input-cache)
 *     user   = assembleBundle(...)      (volatile, per-request)
 *
 * DOES NOT import engine module or scoring core (D-08 bounded-context isolation).
 *
 * Length cap note: BUNDLE_CHAR_CAP is a named constant tuned post-authoring.
 * After BASE + Ideas slice exist (Plan 03 pilot) the value should be sized so the
 * live tier stays the cheap-varying part relative to the warm cached prefix (D-03 / D-05).
 * The current value is a conservative starting point — adjust after measuring the
 * authored slice sizes vs typical live bundle sizes.
 */

import { z } from "zod";
import { PROFILE_ROLE_MAP, type Role, type ProfileRow } from "./profile-role-map";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Hard character cap on the assembled live bundle.
 *
 * TUNED POST-AUTHORING: this value is a placeholder sized conservatively for v1.
 * After Plan 03 authors BASE + Ideas slice, resize so the live tier (this bundle)
 * stays the cheap-varying part vs the warm cached system-prompt prefix (D-03).
 * Rule: live bundle << system prompt size (the warm cache must be the dominant tier).
 *
 * At this cap, lowest-priority roles are dropped (not truncated mid-field) until
 * the bundle fits. The ask/overrides/anchor sections are always included (they
 * represent the user's request and are never dropped).
 */
export const BUNDLE_CHAR_CAP = 4000;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Valid platforms for generation. TikTok-first (D-07); craft is TikTok-native
 * with inline Reels/Shorts notes where it materially changes craft.
 */
const platformSchema = z.enum(["tiktok", "instagram", "youtube"]);

/**
 * Generation modes. Each mode has a declared role set (MODE_ROLES).
 */
const modeSchema = z.enum(["idea", "hooks", "chat"]);

/**
 * Assembler input — the D-05 live-tier input shape.
 *
 * Extends the Phase-1 ToolInput semantically (D-07 forward-wire) so Phase 3
 * wires the platform chip and mode into the assembler without retrofitting types.
 *
 * Fields:
 *   ask       — Composer free-text (the creator's request). ALWAYS fenced.
 *   platform  — First-class param (D-07). Wins over profile target_platforms[0].
 *   mode      — Which tool is calling the assembler (determines role set).
 *   overrides — Optional Tier-B per-request overrides. FENCED when present.
 *   anchor    — Optional chain anchor (upstream idea for hooks; recent turns for chat). FENCED.
 */
export const assemblerInputSchema = z.object({
  ask: z.string().min(1, "ask must not be empty"),
  platform: platformSchema,
  mode: modeSchema,
  overrides: z.string().optional(),
  anchor: z.string().optional(),
});

export type AssemblerInput = z.infer<typeof assemblerInputSchema>;

// ─── MODE_ROLES ───────────────────────────────────────────────────────────────

/**
 * Declares which semantic roles each mode pulls from the profile.
 * Roles are ordered by PRIORITY (highest first): later roles are dropped first
 * when the assembled bundle exceeds BUNDLE_CHAR_CAP.
 *
 * Ideas   — full creator picture (all six roles) to find resonant angles
 * Hooks   — develops a specific idea; goals excluded (idea is the primary input)
 * Chat    — thin; base-heavy (D-14); only niche/audience/platform for context
 */
export const MODE_ROLES: Record<AssemblerInput["mode"], Role[]> = {
  idea: ["niche", "audience", "goals", "wins", "flops", "platform"],
  hooks: ["niche", "audience", "platform", "wins", "flops"],
  chat: ["niche", "audience", "platform"],
};

// ─── Injection fence helpers ──────────────────────────────────────────────────

/**
 * Strip <<<USER_CONTENT>>> and <<<END_USER_CONTENT>>> sentinels from user input.
 * Defense-in-depth: a user could paste these literal strings to escape the fence.
 * Mirror of creator.ts:252-254 / sanitizeText in creator-profile.ts.
 */
function stripUserContentSentinels(input: string): string {
  return input.replace(/<<<(?:END_)?USER_CONTENT>>>/gi, "");
}

/**
 * Wrap user-supplied text in the injection fence.
 * Sentinel-strips the content first so the fence remains unforgeable.
 */
function fenceUserContent(label: string, content: string): string {
  const clean = stripUserContentSentinels(content);
  return `${label}:\n<<<USER_CONTENT>>>\n${clean}\n<<<END_USER_CONTENT>>>`;
}

// ─── Cold-start detection ─────────────────────────────────────────────────────

/**
 * Determine if a profile row is thin (provides no useful grounding data).
 * Null row = no profile at all. Row with all null fields = effectively thin.
 */
function isProfileThin(profileRow: ProfileRow | null): boolean {
  if (profileRow === null) return true;
  const hasNiche = Boolean(profileRow.niche_primary);
  const hasAudience = Boolean(profileRow.target_audience);
  const hasGoals = Boolean(profileRow.primary_goal);
  const hasWins = Boolean(profileRow.past_wins?.length);
  const hasFlops = Boolean(profileRow.past_flops?.length);
  const hasPlatform = Boolean(profileRow.target_platforms?.length);
  return !hasNiche && !hasAudience && !hasGoals && !hasWins && !hasFlops && !hasPlatform;
}

// ─── Core assembler ───────────────────────────────────────────────────────────

/**
 * Assemble the per-request live-tier grounding bundle.
 *
 * Returns the VOLATILE USER MESSAGE string for the Qwen generation call.
 *
 * Algorithm:
 *   1. Validate input with zod (input validation at system boundary per CLAUDE.md).
 *   2. Determine profile tier: full / thin → honest cold-start flag.
 *   3. Pull only MODE_ROLES[mode] from the profile via PROFILE_ROLE_MAP.
 *   4. Enforce BUNDLE_CHAR_CAP: drop lowest-priority roles (tail of MODE_ROLES) first.
 *   5. Fence ask/overrides/anchor in <<<USER_CONTENT>>> blocks.
 *   6. Return assembled user message.
 *
 * @param input       Typed assembler input (validated at boundary).
 * @param profileRow  creator_profiles row (null = no profile / cold-start).
 * @returns The volatile user message string for the Qwen call.
 */
export function assembleBundle(
  input: AssemblerInput,
  profileRow: ProfileRow | null,
): string {
  // 1. Validate input at the function boundary (CLAUDE.md: "validate input at system boundaries")
  const parsed = assemblerInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`assembleBundle: invalid input — ${parsed.error.message}`);
  }
  const { ask, platform, mode, overrides, anchor } = parsed.data;

  const roles = MODE_ROLES[mode];
  const thin = isProfileThin(profileRow);

  // 2. Build profile section lines (only roles in this mode's set)
  const profileLines: string[] = [];

  if (thin) {
    // Cold-start: honest baseline flag — never fabricate a profile value (D-05)
    profileLines.push(`Creator profile: thin (using ${platform} baseline)`);
    profileLines.push(
      `Craft as universal-${platform} — no creator-specific grounding available.`,
    );
  } else {
    // Full profile: pull only the roles this mode declares
    for (const role of roles) {
      const formatted =
        role === "platform"
          ? // D-07: per-request platform param wins over profile default
            `Target platform: ${platform}`
          : PROFILE_ROLE_MAP[role](profileRow!);
      if (formatted !== null) {
        profileLines.push(formatted);
      }
    }

    // If we pulled roles but all returned null → effectively thin
    if (profileLines.length === 0) {
      profileLines.push(`Creator profile: thin (using ${platform} baseline)`);
      profileLines.push(
        `Craft as universal-${platform} — no creator-specific grounding available.`,
      );
    }
  }

  // 3. Build fenced user-input sections (always included — user request is the primary signal)
  const fencedSections: string[] = [];
  fencedSections.push(fenceUserContent("Creator ask", ask));
  if (overrides) fencedSections.push(fenceUserContent("Per-request overrides", overrides));
  if (anchor) fencedSections.push(fenceUserContent("Chain anchor", anchor));

  // 4. Enforce BUNDLE_CHAR_CAP
  //    Strategy: user-request sections always fit (they are the primary signal).
  //    Profile roles drop from the tail (lowest priority) when the budget is exceeded.

  const fencedText = fencedSections.join("\n\n");
  const header = `## Live Grounding Bundle\nMode: ${mode} | Platform: ${platform}\n\n`;
  const profileHeader = `### Creator Profile\n`;

  // Reserve space for header + fenced sections
  const reservedChars = header.length + fencedText.length + profileHeader.length + 4; // +4 for separators
  const profileBudget = BUNDLE_CHAR_CAP - reservedChars;

  // Drop lowest-priority roles from the tail to fit within budget
  let profileSection = profileLines.join("\n");
  if (profileSection.length > profileBudget && profileBudget > 0) {
    const keptLines: string[] = [];
    let used = 0;
    for (const line of profileLines) {
      const lineLen = line.length + 1; // +1 for newline
      if (used + lineLen <= profileBudget) {
        keptLines.push(line);
        used += lineLen;
      }
      // Once budget exhausted: drop remaining lines (lower priority roles)
    }
    profileSection = keptLines.join("\n");
  }

  // 5. Assemble final user message
  const parts: string[] = [
    header,
    profileHeader + profileSection,
    "---",
    fencedText,
  ];

  const result = parts.join("\n\n");

  // Final safety cap — if fenced text alone exceeds cap, hard-truncate at word boundary
  if (result.length > BUNDLE_CHAR_CAP) {
    return result.substring(0, BUNDLE_CHAR_CAP);
  }

  return result;
}
