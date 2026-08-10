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
 * Rule this value serves: live bundle << system prompt size (the warm cache must be the
 * dominant tier, D-03/D-05).
 *
 * RESIZED 4000 → 6000 (2026-08-10), because 4000 was silently de-personalising the very runs
 * grounding exists to improve. Measured through this function with the real prod profile shape:
 *
 *   hooks · corpus 2800, no overrides           3818 / 4000   all roles kept
 *   hooks · corpus 2800 + calibrated overrides  3602 / 4000   voice + wins + flops + platform ALL DROPPED
 *
 * A calibrated audience is simultaneously the only thing that PRODUCES a voice (it is backfilled
 * from creator_persona.writing_style_sample — see apply-creator-persona.ts, and note that
 * creator_profiles.writing_voice_sample does not exist in the database) and the thing whose
 * `overrides` block evicts it. The drop loop pops whole roles, so it shed 675 chars to save 256.
 *
 * The old comment on grounding/prompt.ts's SKILL_CHAR_BUDGET reasoned from the same number and
 * drew the opposite conclusion — "the assembled bundle lands ~3.6k … so the corpus still cannot
 * evict a creator's profile roles". 3.6k IS the post-eviction length. Do not re-derive headroom
 * from an output length; assert on which roles survive.
 *
 * Why 6000 and not more: the rule above still has to hold. Measured system-prompt sizes are
 * 46,485 (hooks) / 35,664 (ideas) / 33,953 (script) / 25,268 (chat) chars, so 6000 is 12.9%–23.7%
 * of the tier it must stay small against — comfortably the minor tier, where 4000 was 8.6%–15.8%.
 * Cost is not the constraint at either value (qwen3.7-flash: $0.03/M input at ≤32K). 6000 also
 * clears the worst realistic bundle (~5,585 = corpus 2800 + overrides + anchor + 5 cards + a full
 * profile + the conversation digest + labels), so on real traffic nothing sheds at all and the
 * shed ORDER below is a tiebreak rather than a routine event.
 *
 * At this cap, sections are shed by declared priority (see the shed order in assembleBundle step
 * 4) — never truncated mid-field. The ask/overrides/anchor/cards sections are always included
 * (they represent the user's request and are never dropped).
 */
export const BUNDLE_CHAR_CAP = 6000;

/**
 * Character budget for the conversation digest, applied by the BUILDER before the section ever
 * reaches this module (same contract as CORPUS_CHAR_BUDGET in grounding/prompt.ts, and for the
 * same reason: an unbudgeted section does not merely get truncated at the cap, it competes with
 * the creator's own grounding).
 *
 * Exported so the builder and the cap reason from one number.
 */
export const CONVERSATION_CHAR_BUDGET = 700;

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
 *   modeLabel — Optional override for the WORD printed in the bundle header, and nothing else.
 *               `mode` stays the role selector; this only changes what the model is TOLD it is
 *               doing. Exists because the header leaks into the user message, where the bare
 *               word "chat" collides with the chat slice's stance ("chat mode is conversational,
 *               not a generation surface") and talked the agent loop out of dispatching a skill
 *               it had bound and been told to call — measured 0/4 dispatches with "chat" vs 4/4
 *               with any other label, same seeds. Omitted → byte-identical to before.
 */
export const assemblerInputSchema = z.object({
  ask: z.string().min(1, "ask must not be empty"),
  platform: platformSchema,
  mode: modeSchema,
  overrides: z.string().optional(),
  anchor: z.string().optional(),
  corpus: z.string().optional(),
  modeLabel: z.string().min(1).optional(),
  /**
   * Stage B (B2): the exact lines of cards ALREADY ON SCREEN that this run is asked to
   * rewrite/sharpen — "Punch them up" under a 5-hook pack, "rewrite these" in chat. Fenced
   * as their own numbered section (cardsLabel) so the model improves THESE items instead of
   * generating unrelated new ones — the measured "rewrite these returns strangers" defect.
   * Distinct from `anchor` on purpose: the anchor carries the open-from-this contract
   * (anchorHonored enforces it); a rewrite pack carries no such opening constraint.
   */
  cards: z.array(z.string().min(1)).min(1).max(6).optional(),
  /**
   * THE CONVERSATION (2026-08-10). What the creator has said in this thread, as data.
   *
   * Until now a generator pipeline received `ask`, `anchor`, `cards`, the profile and the
   * audience — and NO conversation. Twenty turns reached the generating model only insofar as the
   * chat agent compressed them into the one `topic` string it wrote into the tool call. That is
   * why "given everything I've told you, what angle should I lead with?" works (the chat agent has
   * the turns as real role messages) while the hooks it then generates can feel like they forgot
   * the conversation (the generator never saw them).
   *
   * `turns` is the creator's OWN words only — never the assistant's prose. That exclusion is
   * load-bearing, not tidiness: chat-prior-turns.ts documents the defect this subsystem exists to
   * fix, where the model saw its own sentence "Five hooks are on screen." with no visible cause
   * and, asked again, reproduced the sentence and called nothing. Feeding assistant prose into a
   * GENERATOR bundle would import that failure into a second place. The creator's words are also
   * where the durable signal lives — the stated constraints ("under 30s", "not the 5am angle").
   *
   * `cardsOnScreen` is the assistant's concrete contribution: what the creator is looking at.
   * MUTUALLY EXCLUSIVE with `cards` by contract (enforced by the caller, asserted by the label
   * below): `cards` says REWRITE each of these, `cardsOnScreen` says these already exist, do not
   * repeat them. Emitting both would put two contradictory instructions over one list and corrupt
   * the rewrite path measured at 7% → 75% subject retention.
   */
  conversation: z
    .object({
      turns: z.array(z.string().min(1)).max(12).optional(),
      cardsOnScreen: z.array(z.string().min(1)).max(6).optional(),
    })
    .optional(),
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

// ─── Anchor contract (Stage A, N-7) ──────────────────────────────────────────

/**
 * The label the anchor fence is emitted under — per mode, because the anchor MEANS a
 * different thing per mode and the label is the only instruction the model gets about it.
 *
 * N-7 (2026-08-09 live run): a "Write a script from #1" chip shipped the chosen hook in a
 * fence labeled just "Chain anchor", next to a topic-free ask — no prompt text anywhere
 * said what a chain anchor IS or that the script must open from it. The model freestyled
 * an audience-flavored topic (a dance-challenge script from a morning-routine hook) while
 * retrieval keyed correctly off the anchor. The contract has to live HERE, beside the
 * content, because the system prompts are byte-stable compiled slices this per-request
 * data must not invalidate.
 */
function anchorLabel(mode: AssemblerInput["mode"]): string {
  switch (mode) {
    case "script":
      return (
        "Anchor hook — REQUIRED: the script MUST open from this exact hook. " +
        "Keep its subject and its promise; adapt the wording, never the topic"
      );
    case "hooks":
      return "Chain anchor — the chosen idea these hooks develop; every hook must be about THIS subject";
    default:
      return "Chain anchor";
  }
}

/**
 * The label the rewrite-pack fence (`cards`) is emitted under — the same rule as anchorLabel:
 * the contract lives beside the content, because the compiled system prompts cannot know about
 * per-request data. States what the items ARE and what the run owes them: replacements, not
 * neighbours. Per-mode nouns keep the instruction concrete.
 */
function cardsLabel(mode: AssemblerInput["mode"]): string {
  // "script beats", not "script": a script pack is the BEATS of the one script on screen (each
  // numbered line is "Hook: …", "Turn: …"), so "REWRITE these exact script" both misreads as a
  // pack of whole scripts and is the wrong count for what follows it.
  const noun =
    mode === "script" ? "script beats" : mode === "idea" ? "ideas" : mode === "hooks" ? "hooks" : "items";
  return (
    `Cards to improve — the creator is asking you to REWRITE these exact ${noun}, which are ` +
    `already on their screen. Deliver a sharper version of EACH numbered item, keeping its ` +
    `subject and its core promise — never replace one with an unrelated new ${noun === "items" ? "item" : noun.replace(/s$/, "")}`
  );
}

/** The rewrite pack as one fenced body: a numbered list, one line per card. */
function cardsContent(cards: string[]): string {
  return cards.map((c, i) => `${i + 1}. ${c}`).join("\n");
}

/**
 * The conversation digest as ONE fenced block, emitted above the `---` (see assembleBundle).
 *
 * Same rule as anchorLabel/cardsLabel: the contract lives beside the content, because the system
 * prompts are byte-stable compiled slices that per-request data must not invalidate. Each
 * sub-block states plainly what it IS and what the run owes it — a generator that is handed a
 * transcript with no contract will read it as more topic.
 *
 * Returns null when there is nothing to say, so an empty object is a byte-identical no-op.
 */
function conversationContent(conversation: {
  turns?: string[];
  cardsOnScreen?: string[];
}): string | null {
  const parts: string[] = [];
  if (conversation.turns && conversation.turns.length > 0) {
    parts.push(
      "What the creator has said in this conversation, oldest first — their own words. " +
        "Honour anything they stated as a constraint or a rejection here (length, format, an " +
        "angle they already ruled out) as if it were part of the request:\n" +
        conversation.turns.map((t, i) => `${i + 1}. ${t}`).join("\n"),
    );
  }
  if (conversation.cardsOnScreen && conversation.cardsOnScreen.length > 0) {
    // Deliberately the OPPOSITE instruction to cardsLabel's. See the `conversation` field comment
    // for why the two can never be emitted together.
    parts.push(
      "Already on the creator's screen from earlier in this thread — do NOT reproduce, rephrase " +
        "or re-deliver these; make something new that does not overlap them:\n" +
        conversation.cardsOnScreen.map((c) => `· ${c}`).join("\n"),
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}

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
 *   4. Enforce BUNDLE_CHAR_CAP by SHED ORDER (see step 4) — never truncated mid-field.
 *   5. Fence ask/overrides/anchor/cards/corpus in <<<USER_CONTENT>>> blocks.
 *   6. Return assembled user message.
 *
 * SECTION ORDER IS A CACHE DECISION, not a cosmetic one. DashScope runs an implicit context
 * cache for Qwen and the hit is on the longest common TOKEN PREFIX of the request. The prefix
 * runs [system prompt][header][profile section][conversation] and dies at `Creator ask`, which
 * is volatile every single turn. So the conversation digest is emitted ABOVE the `---`, before
 * the ask: within a thread it is append-only (turn N+1's digest contains turn N's as a literal
 * prefix) for as long as the window has not slid, which extends the cached prefix through it.
 * Placed below the ask it could never be cached at all, because the prefix is already dead
 * there. When the window does slide this degrades to exactly the old extent — never worse.
 * Fencing above the `---` has precedent: the `voice` role already emits a USER_CONTENT fence.
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
  const { ask, platform, mode, overrides, anchor, corpus, modeLabel, cards, conversation } =
    parsed.data;

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
  //    `corpus` is listed separately below because it is the FIRST thing shed (step 4a).
  const userSections: string[] = [];
  userSections.push(fenceUserContent("Creator ask", ask));
  if (overrides) userSections.push(fenceUserContent("Per-request overrides", overrides));
  if (anchor) userSections.push(fenceUserContent(anchorLabel(mode), anchor));
  if (cards) userSections.push(fenceUserContent(cardsLabel(mode), cardsContent(cards)));

  // The conversation digest — its own block, ABOVE the `---` (see the cache note in the header
  // doc). Fenced like every other creator-supplied string, so sentinel-stripping is inherited.
  // ENFORCED, not merely documented: a rewrite run must never also be told "do not reproduce
  // these". `cards` and `cardsOnScreen` are usually the SAME lines, under opposite instructions —
  // "deliver a sharper version of EACH" vs "do not reproduce or rephrase these" — so emitting
  // both would put the run in direct contradiction over one list and would corrupt the rewrite
  // path measured at 7% → 75% subject retention. The caller owns the contract; this is the
  // structure that makes a caller mistake harmless. `turns` is unaffected either way.
  const conversationBody = conversation
    ? conversationContent(cards ? { ...conversation, cardsOnScreen: undefined } : conversation)
    : null;
  const conversationBlock = conversationBody
    ? fenceUserContent("This conversation so far", conversationBody)
    : null;

  // 4. Enforce BUNDLE_CHAR_CAP — WITHOUT ever structurally breaking a fence.
  //
  //    SHED ORDER (2026-08-10). The old order popped PROFILE ROLES first and never touched a
  //    fenced section until the 4b overflow path, which is exactly backwards: it made someone
  //    else's proven video outrank the creator's own voice. Measured consequence, and the reason
  //    this changed — see the BUNDLE_CHAR_CAP note. New order, lowest priority first:
  //
  //      (a) corpus        — the REDUNDANT tier. grounding/prompt.ts says it best: "six proven
  //                          sources still teach with four". There is only one creator.
  //      (b) conversation  — the session transcript. Ranks ABOVE corpus because it carries the
  //                          creator's EXPLICIT stated constraints ("under 30s", "not the 5am
  //                          angle"), and violating a stated instruction is a worse failure than
  //                          having one fewer example.
  //      (c) profile roles — from the tail of MODE_ROLES (platform → flops → wins → voice).
  //      (d) never         — niche, audience, ask, overrides, anchor, cards.
  //
  //    Whole sections only, never mid-field. At the current cap this is a TIEBREAK, not a routine
  //    event: the worst realistic bundle measures ~5,585 against a 6,000 cap.
  //
  //    (e) If the fenced content alone still overflows, rebuild the fenced sections within the
  //        remaining budget — truncating INNER text only, sentinels always intact — with `ask`
  //        allocated budget first. A final substring on the assembled result (the old behaviour)
  //        is never used: it could chop a closing sentinel and void the fence (CR-01/CR-02).
  //
  // The header is part of the USER message, so this word is an instruction to the model, not a
  // log line — see `modeLabel` on the input schema for why callers may need to override it.
  const header = `## Live Grounding Bundle\nMode: ${modeLabel ?? mode} | Platform: ${platform}\n\n`;
  const profileHeader = `### Creator Profile\n`;
  const JOIN = "\n\n";

  const buildResult = (
    profileBody: string,
    conversationPart: string | null,
    fenced: string[],
  ): string => {
    const blocks: string[] = [header];
    if (profileBody.length > 0) blocks.push(profileHeader + profileBody);
    if (conversationPart) blocks.push(conversationPart);
    blocks.push("---", fenced.join(JOIN));
    return blocks.join(JOIN);
  };

  const fullProfile = profileLines.join("\n");
  const withCorpus = (c?: string) =>
    c ? [...userSections, fenceUserContent("Grounded examples", c)] : userSections;

  // 4a. Shed the corpus, then the conversation — before a single profile role is touched.
  let keptCorpus = corpus;
  let keptConversation = conversationBlock;
  if (
    keptCorpus &&
    buildResult(fullProfile, keptConversation, withCorpus(keptCorpus)).length > BUNDLE_CHAR_CAP
  ) {
    keptCorpus = undefined;
  }
  if (
    keptConversation &&
    buildResult(fullProfile, keptConversation, withCorpus(keptCorpus)).length > BUNDLE_CHAR_CAP
  ) {
    keptConversation = null;
  }

  let fencedSections = withCorpus(keptCorpus);

  // 4b. Only now drop lowest-priority profile roles from the tail until the bundle fits
  //     (down to an empty profile section). Whole-line drops only — never mid-field.
  const keptProfile = [...profileLines];
  while (
    keptProfile.length > 0 &&
    buildResult(keptProfile.join("\n"), keptConversation, fencedSections).length > BUNDLE_CHAR_CAP
  ) {
    keptProfile.pop();
  }
  let profileSection = keptProfile.join("\n");

  // 4c. If the fenced user content alone still overflows (even with no profile),
  //     rebuild the fenced sections within the remaining budget. `ask` first.
  let result = buildResult(profileSection, keptConversation, fencedSections);
  if (result.length > BUNDLE_CHAR_CAP) {
    profileSection = ""; // user request takes precedence over grounding
    // Reaching here means the bundle overflowed even with the FULL profile, so 4a already shed
    // both `corpus` and `conversation`. Rebuild from what SURVIVED (keptCorpus / keptConversation),
    // never from the originals — resurrecting a section the shed order just dropped would invert
    // the whole precedence this step exists to enforce.
    const shell = buildResult(profileSection, keptConversation, []); // structure, empty fenced block
    const fencedBudget = Math.max(0, BUNDLE_CHAR_CAP - shell.length);
    const rawSections: { label: string; content: string }[] = [
      { label: "Creator ask", content: ask },
    ];
    if (overrides) rawSections.push({ label: "Per-request overrides", content: overrides });
    if (anchor) rawSections.push({ label: anchorLabel(mode), content: anchor });
    if (cards) rawSections.push({ label: cardsLabel(mode), content: cardsContent(cards) });
    if (keptCorpus) rawSections.push({ label: "Grounded examples", content: keptCorpus });
    result = buildResult(
      profileSection,
      keptConversation,
      fenceSectionsWithinBudget(rawSections, fencedBudget),
    );
  }

  return result;
}
