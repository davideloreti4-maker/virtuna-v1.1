/**
 * assembler.ts — Per-request live-tier grounding assembler (GROUND-02 / D-05).
 *
 * ARCHITECTURAL SPLIT (resolves RESEARCH A4 ambiguity):
 * ─────────────────────────────────────────────────────
 * The STATIC SLICE-BINDING (which compiled KC slice a tool uses) is a build-time,
 * module-level constant — the `KC_<MODE>_SYSTEM_PROMPT` a runner pairs with. It is
 * NOT the live grounding.
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
const modeSchema = z.enum(["idea", "hooks", "chat", "script", "remix"]);

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
 *   corpus    — Optional grounded examples (retrieved outlier teardowns → proof + reusable
 *               structure, grounding/orchestrator.ts). FENCED. Optional-additive: undefined
 *               is a byte-identical no-op (preserves the warm-cache prefix + regression gates).
 *               ONE field grounds idea/hooks/script (§11f).
 */
export const assemblerInputSchema = z.object({
  ask: z.string().min(1, "ask must not be empty"),
  platform: platformSchema,
  mode: modeSchema,
  overrides: z.string().optional(),
  anchor: z.string().optional(),
  corpus: z.string().optional(),
});

export type AssemblerInput = z.infer<typeof assemblerInputSchema>;

// ─── MODE_ROLES ───────────────────────────────────────────────────────────────

/**
 * Declares which semantic roles each mode pulls from the profile.
 * Roles are ordered by PRIORITY (highest first): later roles are dropped first
 * when the assembled bundle exceeds BUNDLE_CHAR_CAP.
 *
 * Ideas   — full creator picture (all six roles + voice) to find resonant angles
 * Hooks   — develops a specific idea; goals excluded (idea is the primary input)
 * Chat    — thin; base-heavy (D-14); only niche/audience/platform for context;
 *            voice excluded (chat grounding must stay base-neutral)
 * Script  — mirrors Hooks role set + voice (GROUND-02 anti-dilution — tight niche+craft
 *            slice, not whole-profile); takes a hook and expands it into a beat
 *            structure; goals excluded (the hook/idea is the primary input)
 * Remix   — mirrors Hooks role set + voice (GROUND-02 anti-dilution — tight niche+craft
 *            slice); adapts a decoded viral video format to the creator's niche;
 *            goals excluded (the source decode anatomy is the primary input)
 *
 * VOICE PRIORITY (KCQ-08 / D-11/D-12): `voice` is intentionally NOT the tail
 * element of idea/hooks/script/remix. The cap-drop loop pops from the tail first,
 * so a voice in tail position was the first thing silently dropped under
 * BUNDLE_CHAR_CAP — making output stop sounding like the creator. Voice now sits
 * ahead of wins/flops/platform so a routine cap-drop sheds lower-signal grounding
 * (recent wins/flops, the per-request-overridable platform line) before the creator's
 * voice. `chat` stays voice-free by design (base-neutral grounding).
 */
export const MODE_ROLES: Record<AssemblerInput["mode"], Role[]> = {
  idea: ["niche", "audience", "goals", "voice", "wins", "flops", "platform"],
  hooks: ["niche", "audience", "voice", "wins", "flops", "platform"],
  chat: ["niche", "audience", "platform"],
  script: ["niche", "audience", "voice", "wins", "flops", "platform"],
  remix: ["niche", "audience", "voice", "wins", "flops", "platform"],
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

/**
 * Rebuild fenced user sections so their JOINED length fits `budget`, truncating INNER
 * content only — the <<<USER_CONTENT>>> / <<<END_USER_CONTENT>>> sentinels are ALWAYS
 * emitted intact (never chopped by a length cap). This is the overflow-path guarantee
 * that keeps the injection fence unbreakable even when the user request alone exceeds
 * BUNDLE_CHAR_CAP (the bug class CR-01/CR-02 fixed: a blind substring on the assembled
 * result could truncate the closing sentinel and silently void the fence).
 *
 * Sections are processed in priority order (first = highest priority, gets budget first).
 * A section with no room left for even an empty fence is dropped, along with all that follow.
 */
function fenceSectionsWithinBudget(
  sections: { label: string; content: string }[],
  budget: number,
): string[] {
  const out: string[] = [];
  let used = 0;
  for (const { label, content } of sections) {
    const sep = out.length > 0 ? 2 : 0; // "\n\n" join between sections
    const clean = stripUserContentSentinels(content);
    const open = `${label}:\n<<<USER_CONTENT>>>\n`;
    const close = `\n<<<END_USER_CONTENT>>>`;
    const avail = budget - used - sep - open.length - close.length;
    if (avail <= 0) break; // no room for even an empty fence → drop this and the rest
    const inner = clean.slice(0, Math.min(clean.length, avail));
    const fenced = `${open}${inner}${close}`;
    out.push(fenced);
    used += sep + fenced.length;
  }
  return out;
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
  const hasVoice = Boolean(profileRow.writing_voice_sample?.trim());
  return !hasNiche && !hasAudience && !hasGoals && !hasWins && !hasFlops && !hasPlatform && !hasVoice;
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
  const { ask, platform, mode, overrides, anchor, corpus } = parsed.data;

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

  // 3. Build fenced user-input sections (always included — user request is the primary signal).
  const fencedSections: string[] = [];
  fencedSections.push(fenceUserContent("Creator ask", ask));
  if (overrides) fencedSections.push(fenceUserContent("Per-request overrides", overrides));
  if (anchor) fencedSections.push(fenceUserContent("Chain anchor", anchor));
  if (corpus) fencedSections.push(fenceUserContent("Grounded examples", corpus));

  // 4. Enforce BUNDLE_CHAR_CAP — WITHOUT ever structurally breaking a fence.
  //    Precedence: the fenced user request is primary; profile grounding yields first.
  //    (a) Drop whole profile roles from the tail (never mid-field) until the bundle fits.
  //    (b) If the fenced content alone still overflows, rebuild the fenced sections within
  //        the remaining budget — truncating INNER text only, sentinels always intact —
  //        with `ask` allocated budget first. A final substring on the assembled result
  //        (the old behaviour) is never used: it could chop a closing sentinel and void
  //        the injection fence (CR-01/CR-02).
  const header = `## Live Grounding Bundle\nMode: ${mode} | Platform: ${platform}\n\n`;
  const profileHeader = `### Creator Profile\n`;
  const JOIN = "\n\n";

  const buildResult = (profileBody: string, fenced: string[]): string => {
    const blocks: string[] = [header];
    if (profileBody.length > 0) blocks.push(profileHeader + profileBody);
    blocks.push("---", fenced.join(JOIN));
    return blocks.join(JOIN);
  };

  // 4a. Drop lowest-priority profile roles from the tail until the bundle fits
  //     (down to an empty profile section). Whole-line drops only — never mid-field.
  const keptProfile = [...profileLines];
  while (
    keptProfile.length > 0 &&
    buildResult(keptProfile.join("\n"), fencedSections).length > BUNDLE_CHAR_CAP
  ) {
    keptProfile.pop();
  }
  let profileSection = keptProfile.join("\n");

  // 4b. If the fenced user content alone still overflows (even with no profile),
  //     rebuild the fenced sections within the remaining budget. `ask` first.
  let result = buildResult(profileSection, fencedSections);
  if (result.length > BUNDLE_CHAR_CAP) {
    profileSection = ""; // user request takes precedence over grounding
    const shell = buildResult(profileSection, []); // structure with an empty fenced block
    const fencedBudget = Math.max(0, BUNDLE_CHAR_CAP - shell.length);
    const rawSections: { label: string; content: string }[] = [
      { label: "Creator ask", content: ask },
    ];
    if (overrides) rawSections.push({ label: "Per-request overrides", content: overrides });
    if (anchor) rawSections.push({ label: "Chain anchor", content: anchor });
    if (corpus) rawSections.push({ label: "Grounded examples", content: corpus });
    result = buildResult(profileSection, fenceSectionsWithinBudget(rawSections, fencedBudget));
  }

  return result;
}
