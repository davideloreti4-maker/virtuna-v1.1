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
 *     → hard length cap (BUNDLE_CHAR_CAP, plus the room of the facts of You, which are never shed;
 *       see bundleCharCap) with lowest-priority role drop
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
import { stripUserContentMarkers } from "@/lib/user-content-markers";
import { asksToSell } from "./asks-to-sell";
import {
  YOU_ROLES,
  isProfileThin,
  roleLineFor,
  youFact,
  type Role,
  type ProfileRow,
} from "./profile-role-map";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Hard character cap on the assembled live bundle, for everything that is not a fact of You.
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
 * ⚠️ THE MEASUREMENT ABOVE PREDATES #482 AND ITS VOICE ROW IS NOW ALWAYS EMPTY. At the time, a
 * calibrated audience was simultaneously the only thing that PRODUCED a voice (backfilled from
 * creator_persona.writing_style_sample) and the thing whose `overrides` block evicted it. That
 * backfill was the exemplar-copying defect and was removed 2026-08-12 — see
 * apply-creator-persona.ts. `writing_voice_description` (renamed 2026-08-13) has NO producer:
 * `creator_profiles` had no voice column, verified against prod 2026-08-13. The 6000 cap stands on
 * the wins/flops/platform half of the same measurement. Something fills the slot again since
 * 2026-11-24 (the You page, read only under the new look), and it rides on top of the cap (below).
 *
 * The old comment on grounding/prompt.ts's SKILL_CHAR_BUDGET reasoned from the same number and
 * drew the opposite conclusion — "the assembled bundle lands ~3.6k … so the corpus still cannot
 * evict a creator's profile roles". 3.6k IS the post-eviction length. Do not re-derive headroom
 * from an output length; assert on which roles survive.
 *
 * THE FACTS OF YOU RIDE ON TOP (2026-11-24, plan 2026-11-24-you, the controller's ruling 14). This
 * number is the cap of everything that is NOT a fact of You. A bundle's cap is this number plus
 * exactly what its fact lines add (`bundleCharCap`), and no step ever sheds a fact line, so a
 * creator's own words never take room from anything else and are never dropped: the promise is that
 * nothing that fits today is dropped because a creator filled in You. Every other part of a bundle
 * (ask, anchor, overrides, cards, corpus, conversation, the other profile lines) gets exactly the
 * room it had before You existed, and a bundle without a fact line is byte for byte what it was
 * (you-facts.unchanged.test.ts, you-facts.invariant.test.ts).
 *
 * Measured through this function with every fact at its limit and an ask to sell (so hooks, idea
 * and script print "What you sell" too: SELLS_ONLY_WHEN_ASKED), the longest a bundle can be is 6,000
 * plus what the mode's fact lines add when they are the only profile lines left (the fenced rebuild
 * in step 4):
 *
 *   hooks   never, voice, sells, about          7,954   17.1% of its system prompt (46,485)
 *   idea    never, voice, sells, about, film    8,354   23.4% of 35,664
 *   script  never, voice, sells, about, film    8,354   24.6% of 33,953
 *   chat    never, sells, about                 7,426   29.4% of 25,268
 *
 * (Chat's never line is shorter: it has its own header, CHAT_NEVER_HEADER, and the cap counts the
 * line printed.) For an ask that does not sell, hooks, idea and script print no offer line: 7,462 /
 * 7,862 / 7,862. (With other profile lines left, the facts add only their lines and newlines:
 * 1,933 / 2,333 / 2,333 / 1,405; the other 21 are the profile block's header and blank line, which
 * the facts bring back when they are the only lines left.) Still the minor tier (6,000 alone is
 * 12.9%–23.7%). Cost
 * is not the constraint (qwen3.7-flash: $0.03/M input at ≤32K). The worst realistic grounded bundle
 * (the fixtures of assembler-conversation.test.ts, with an ask to sell) sheds nothing with or
 * without the facts, no fact → every fact at its limit: hooks 5,267 → 7,200, script 5,328 → 7,661,
 * idea (no anchor, no cards) 4,509 → 6,842, chat 4,982 → 6,387.
 *
 * Within the cap, sections are shed by declared priority (see the shed order in assembleBundle step
 * 4) — never truncated mid-field. The ask/overrides/anchor/cards sections are always included
 * (they represent the user's request and are never dropped).
 */
export const BUNDLE_CHAR_CAP = 6000;

/** The profile block's header, and the blank line that joins the bundle's blocks. */
const PROFILE_HEADER = "### Creator Profile\n";
const BLOCK_JOIN = "\n\n";

/**
 * A bundle's cap: BUNDLE_CHAR_CAP for everything else, plus exactly what its fact-of-You lines add
 * to the bundle, so the facts ride on top and never take anyone's room (ruling 14).
 *
 * `factLines` are the fact lines this mode prints (a fact the mode does not print adds nothing);
 * each adds its length and its joining newline. `alone`: no other profile line is left, so the
 * fact lines also bring back the profile block that is otherwise left out when empty (its header
 * and the blank line before it), less the one newline their last line does not need. With no fact
 * line the cap is BUNDLE_CHAR_CAP exactly.
 */
export function bundleCharCap(factLines: readonly string[], alone = false): number {
  if (factLines.length === 0) return BUNDLE_CHAR_CAP;
  const lines = factLines.reduce((sum, line) => sum + line.length + 1, 0);
  return BUNDLE_CHAR_CAP + lines + (alone ? PROFILE_HEADER.length + BLOCK_JOIN.length - 1 : 0);
}

/**
 * Character budget for the conversation digest, applied by the BUILDER before the section ever
 * reaches this module (same contract as CORPUS_CHAR_BUDGET in grounding/prompt.ts, and for the
 * same reason: an unbudgeted section does not merely get truncated at the cap, it competes with
 * the creator's own grounding).
 *
 * ⚠️ This is a budget on the emitted BLOCK — preamble, numbering and fence included, not just the
 * creator's words. It has been wrong twice, in the same direction, and both times the symptom was
 * a silently ungrounded generation rather than anything visible:
 *
 *   1. `cardsOnScreen` (6 × 120 chars) sat outside the number entirely → block reached 1,844.
 *   2. With that removed, the builder still charged only raw turn TEXT → 640 "legal" chars
 *      emitted a ~960-char block, and the worst realistic bundle still shed the whole corpus.
 *
 * The builder now charges `CONVERSATION_BLOCK_OVERHEAD` up front and per-line numbering per turn,
 * so what is spent is what lands. Two guards keep it honest: the overhead is DERIVED from the
 * preamble/fence strings rather than written down, and a test assembles a budget-max digest and
 * asserts the real emitted block against this number. If a sub-block is ever added here, add its
 * cost to the overhead — and re-measure the worst case rather than reasoning about it.
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
   * There is deliberately NO `cardsOnScreen` companion. It existed until 2026-08-10 and carried
   * the last run's card lines under "do NOT reproduce, rephrase or re-deliver these" — measured,
   * it produced one VERBATIM copy and two near-copies in 10 hooks, and its unbudgeted size
   * evicted the corpus. See conversation-digest.ts's header for the arms and the numbers. Its
   * removal also retires the `cards`/`cardsOnScreen` mutual-exclusion contract, since the
   * contradiction (one list under "rewrite each" AND "do not repeat") can no longer be built.
   */
  conversation: z
    .object({
      turns: z.array(z.string().min(1)).max(12).optional(),
    })
    .optional(),
});

export type AssemblerInput = z.infer<typeof assemblerInputSchema>;

// ─── MODE_ROLES ───────────────────────────────────────────────────────────────

/**
 * Declares which semantic roles each mode pulls from the profile.
 * Roles are ordered by PRIORITY (highest first): later roles are dropped first
 * when the assembled bundle exceeds its cap. The facts of You are never dropped: for them the
 * order decides only where the line prints.
 *
 * Ideas   — the whole creator: niche, audience, never, then how they sound, what they sell,
 *           who they are and what they can film, then goals and the lines that existed before
 *           (wins, flops, platform)
 * Hooks   — as ideas, without goals (the idea is the primary input) and without film
 * Script  — as hooks, with film (a script has to be filmable); takes a hook and expands it
 *           into a beat structure
 * Chat    — base-heavy (D-14): niche, audience, never, sells, about, platform; no voice
 *           (chat grounding stays base-neutral) and no film
 * Remix   — unchanged; no caller passes mode "remix" (remix builds its own creator block,
 *           engine/remix/adapt.ts)
 *
 * The five facts of You (plan 2026-11-24-you) sit in the spec's order of importance (§5), right
 * after niche and audience: never, voice, sells, about, film. They ride on top of the cap and are
 * never shed (the controller's ruling 14); the other lines are shed from the tail exactly as before.
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
  // (In hooks, idea and script the `sells` line prints only for an ask to sell: SELLS_ONLY_WHEN_ASKED.)
  idea: ["niche", "audience", "never", "voice", "sells", "about", "film", "goals", "wins", "flops", "platform"],
  hooks: ["niche", "audience", "never", "voice", "sells", "about", "wins", "flops", "platform"],
  chat: ["niche", "audience", "never", "sells", "about", "platform"],
  script: ["niche", "audience", "never", "voice", "sells", "about", "film", "wins", "flops", "platform"],
  remix: ["niche", "audience", "voice", "wins", "flops", "platform"],
};

/**
 * The modes that print "What you sell" only when the ask asks to sell (`asksToSell`: a selling word,
 * or the ask names the offer; the anchor is read with the ask). The controller's ruling 15, from
 * real runs: printed for every ask, the writers' model pitched the offer, with its price, in an idea
 * for "cooking for flatmates"; no wording in the header stopped it without also losing the offer from
 * asks that do sell. Chat prints the line always (a conversation about pricing has no "ask to sell");
 * remix is not gated here. A line not printed is not a fact line of the bundle: it adds nothing to
 * the cap.
 */
const SELLS_ONLY_WHEN_ASKED: ReadonlySet<AssemblerInput["mode"]> = new Set(["hooks", "idea", "script"]);

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
const CONVERSATION_PREAMBLE =
  "What the creator has said in this conversation, oldest first — their own words. " +
  "Honour anything they stated as a constraint or a rejection here (length, format, an " +
  "angle they already ruled out) as if it were part of the request:\n";

/** The fence label this block is emitted under (see assembleBundle step 3). */
const CONVERSATION_LABEL = "This conversation so far";

/**
 * What the emitted BLOCK costs beyond the creator's own words — the preamble, the fence label and
 * the two sentinels. DERIVED from the very strings above rather than written down, so editing the
 * preamble can never silently widen the block past its budget.
 *
 * Exported because `CONVERSATION_CHAR_BUDGET` is a budget on the BLOCK, and the builder (which
 * spends it) is the only place that can enforce that. Charging turn TEXT alone was the 2026-08-10
 * defect: 640 legal chars of text emitted a ~960-char block, and the difference was enough to push
 * the worst realistic bundle over BUNDLE_CHAR_CAP and shed the entire corpus. Per-line numbering
 * ("12. " + newline) is charged by the builder per turn, not here.
 */
export const CONVERSATION_BLOCK_OVERHEAD =
  CONVERSATION_PREAMBLE.length +
  fenceUserContent(CONVERSATION_LABEL, "").length;

function conversationContent(conversation: { turns?: string[] }): string | null {
  if (!conversation.turns || conversation.turns.length === 0) return null;
  return (
    CONVERSATION_PREAMBLE +
    conversation.turns.map((t, i) => `${i + 1}. ${t}`).join("\n")
  );
}

// ─── Injection fence helpers ──────────────────────────────────────────────────

/**
 * Strip <<<USER_CONTENT>>> and <<<END_USER_CONTENT>>> sentinels from user input.
 * Defense-in-depth: a user could paste these literal strings to escape the fence.
 * The one shared cleaner (`user-content-markers.ts`), as creator.ts and sanitizeText use it.
 */
function stripUserContentSentinels(input: string): string {
  return stripUserContentMarkers(input);
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
// The one thin check is `isProfileThin` in profile-role-map.ts (the chat route and the ideas card
// use the same function).

// ─── Core assembler ───────────────────────────────────────────────────────────

/**
 * Assemble the per-request live-tier grounding bundle.
 *
 * Returns the VOLATILE USER MESSAGE string for the Qwen generation call.
 *
 * Algorithm:
 *   1. Validate input with zod (input validation at system boundary per CLAUDE.md).
 *   2. Determine profile tier: full / thin → honest cold-start flag.
 *   3. Pull only MODE_ROLES[mode] from the profile via PROFILE_ROLE_MAP (roleLineFor).
 *   4. Enforce the cap by SHED ORDER (see step 4) — never truncated mid-field.
 *   5. Fence ask/overrides/anchor/cards/corpus in <<<USER_CONTENT>>> blocks.
 *   6. Return assembled user message.
 *
 * WHY THE CONVERSATION DIGEST SITS ABOVE THE `---`. It groups with the trusted grounding rather
 * than with the per-request user sections, which is also how the shed order treats it (it yields
 * before the profile, after the corpus). Fencing above the `---` has precedent: the `voice` role
 * already emits a USER_CONTENT fence there.
 *
 * ⚠️ THIS PLACEMENT WAS ORIGINALLY CHOSEN FOR A PREFIX-CACHE REASON THAT DID NOT SURVIVE
 * MEASUREMENT, and the correction is recorded here so nobody re-derives the same argument.
 *
 * The argument was: DashScope runs an implicit context cache for Qwen, the hit is on the longest
 * common TOKEN prefix, the digest is append-only within a thread while the ask below it is
 * volatile every turn — so placing the digest above the ask should extend the cached prefix
 * through it. Measured (`.scratch/probe-prefix-cache.ts`), it buys nothing:
 *
 *   · The cache is real and works — 8,960 cached tokens on the live hooks system prompt.
 *   · 8,960 = 35 × 256 exactly, so hits are quantised to 256-token BLOCKS.
 *   · The shipped digest is CONVERSATION_CHAR_BUDGET = 700 chars ≈ 175 tokens. It is smaller
 *     than one block, so it cannot move the number no matter where it sits. The arithmetic
 *     settles this independently of any experiment.
 *
 * Two probe designs failed to isolate the effect before that became clear, and both failure modes
 * are worth knowing: sharing the system prompt between the two arms measures CALL ORDER (whichever
 * ran second inherited the other's warm prefix — one arm read 8,960 purely for going second), and
 * giving each arm its own prefix measures nothing at all, because a fresh prefix does not become
 * cacheable within a 45s window. Do not re-open this without a digest larger than 256 tokens.
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

  // 2. Build profile section lines (only roles in this mode's set). Each line keeps its role (null
  //    for the cold-start lines): the fact-of-You lines ride on top of the cap and are never shed,
  //    so step 4 has to tell them apart.
  const profileLines: { role: Role | null; text: string }[] = [];
  const pushColdStart = () => {
    profileLines.push({ role: null, text: `Creator profile: thin (using ${platform} baseline)` });
    profileLines.push({
      role: null,
      text: `Craft as universal-${platform} — no creator-specific grounding available.`,
    });
  };

  if (thin) {
    // Cold-start: honest baseline flag — never fabricate a profile value (D-05)
    pushColdStart();
  } else {
    // Full profile: pull only the roles this mode declares
    for (const role of roles) {
      // The offer only for an ask to sell, in the modes that gate it (SELLS_ONLY_WHEN_ASKED). The
      // piece being developed or refined (the anchor) counts as part of the ask: "Develop this" runs
      // with no ask of its own and refine's ask is the instruction ("shorter"). The gate reads the
      // fact as the line prints it (youFact), so the two never disagree.
      if (
        role === "sells" &&
        SELLS_ONLY_WHEN_ASKED.has(mode) &&
        !asksToSell([ask, anchor ?? ""].join(" "), youFact(profileRow, "sells") ?? "")
      ) {
        continue;
      }
      const formatted =
        role === "platform"
          ? // D-07: per-request platform param wins over profile default
            `Target platform: ${platform}`
          : // Chat prints "never" under its own header (roleLineFor); the cap counts the line printed.
            roleLineFor(mode, role, profileRow!);
      if (formatted !== null) {
        profileLines.push({ role, text: formatted });
      }
    }

    // If we pulled roles but all returned null → effectively thin
    if (profileLines.length === 0) pushColdStart();
  }

  // The facts of You ride on top (bundleCharCap): step 4 sheds only the other lines, and every check
  // adds the facts' own room to BUNDLE_CHAR_CAP, so each decision is exactly the one the same bundle
  // without them gets. With no fact line this is the code as it always was.
  type ProfileLine = (typeof profileLines)[number];
  const isFact = (line: ProfileLine) => line.role !== null && YOU_ROLES.includes(line.role);
  const factLines = profileLines.filter(isFact).map((line) => line.text);
  const otherLines = profileLines.filter((line) => !isFact(line));
  /** The profile as printed with `others` kept: those lines and every fact line, in MODE_ROLES order. */
  const profileWith = (others: readonly ProfileLine[]) =>
    profileLines
      .filter((line) => isFact(line) || others.includes(line))
      .map((line) => line.text)
      .join("\n");
  /** The cap with `others` kept: with none left, the fact lines open the profile block alone. */
  const capWith = (others: readonly ProfileLine[]) => bundleCharCap(factLines, others.length === 0);

  // 3. Build fenced user-input sections (always included — user request is the primary signal).
  //    `corpus` is listed separately below because it is the FIRST thing shed (step 4a).
  const userSections: string[] = [];
  userSections.push(fenceUserContent("Creator ask", ask));
  if (overrides) userSections.push(fenceUserContent("Per-request overrides", overrides));
  if (anchor) userSections.push(fenceUserContent(anchorLabel(mode), anchor));
  if (cards) userSections.push(fenceUserContent(cardsLabel(mode), cardsContent(cards)));

  // The conversation digest — its own block, ABOVE the `---` (see the cache note in the header
  // doc). Fenced like every other creator-supplied string, so sentinel-stripping is inherited.
  //
  // This used to strip `cardsOnScreen` whenever a `cards` rewrite pack was present, because the
  // two carried opposite instructions over one list. `cardsOnScreen` is gone (2026-08-10 — it
  // reproduced the cards it forbade and evicted the corpus; see conversation-digest.ts), so the
  // contradiction cannot occur and there is nothing left to enforce. `turns` was never part of
  // it: the creator's own words are compatible with a rewrite pack.
  const conversationBody = conversation ? conversationContent(conversation) : null;
  const conversationBlock = conversationBody
    ? fenceUserContent(CONVERSATION_LABEL, conversationBody)
    : null;

  // 4. Enforce the cap (`capWith` above) — WITHOUT ever structurally breaking a fence.
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
  //      (c) profile roles — from the tail of MODE_ROLES, one whole line at a time, down to an
  //                          empty profile (niche and audience go last). Fact-of-You lines are
  //                          skipped: they are never shed (the controller's ruling 14, 2026-11-24).
  //      (d) never         — ask, overrides, anchor, cards (step (e) may cut inside their fences,
  //                          never the fences), and every fact-of-You line.
  //
  //    Whole sections only, never mid-field. At the current cap this is a TIEBREAK, not a routine
  //    event: the worst realistic bundle measures 5,261 (hooks) / 5,322 (script) against 6,000,
  //    with the facts of You on top of that.
  //
  //    (e) If the fenced content alone still overflows, rebuild the fenced sections within the
  //        remaining budget — truncating INNER text only, sentinels always intact — with `ask`
  //        allocated budget first. A final substring on the assembled result (the old behaviour)
  //        is never used: it could chop a closing sentinel and void the fence (CR-01/CR-02).
  //        It works its budget out against BUNDLE_CHAR_CAP with an empty profile, exactly as it
  //        always did, drops the other profile lines, and then puts the fact lines back on top: the
  //        bundle is then at most `bundleCharCap(factLines, true)`.
  //
  // The header is part of the USER message, so this word is an instruction to the model, not a
  // log line — see `modeLabel` on the input schema for why callers may need to override it.
  const header = `## Live Grounding Bundle\nMode: ${modeLabel ?? mode} | Platform: ${platform}\n\n`;

  const buildResult = (
    profileBody: string,
    conversationPart: string | null,
    fenced: string[],
  ): string => {
    const blocks: string[] = [header];
    if (profileBody.length > 0) blocks.push(PROFILE_HEADER + profileBody);
    if (conversationPart) blocks.push(conversationPart);
    blocks.push("---", fenced.join(BLOCK_JOIN));
    return blocks.join(BLOCK_JOIN);
  };

  const fullProfile = profileWith(otherLines);
  const fullCap = capWith(otherLines);
  const withCorpus = (c?: string) =>
    c ? [...userSections, fenceUserContent("Grounded examples", c)] : userSections;

  // 4a. Shed the corpus, then the conversation — before a single profile role is touched.
  let keptCorpus = corpus;
  let keptConversation = conversationBlock;
  if (
    keptCorpus &&
    buildResult(fullProfile, keptConversation, withCorpus(keptCorpus)).length > fullCap
  ) {
    keptCorpus = undefined;
  }
  if (
    keptConversation &&
    buildResult(fullProfile, keptConversation, withCorpus(keptCorpus)).length > fullCap
  ) {
    keptConversation = null;
  }

  const fencedSections = withCorpus(keptCorpus);

  // 4b. Only now drop lowest-priority profile roles from the tail until the bundle fits
  //     (down to an empty profile section). Whole-line drops only — never mid-field. Only the
  //     other lines are dropped; the fact lines stay where they print.
  const keptOthers = [...otherLines];
  while (
    keptOthers.length > 0 &&
    buildResult(profileWith(keptOthers), keptConversation, fencedSections).length >
      capWith(keptOthers)
  ) {
    keptOthers.pop();
  }
  const profileSection = profileWith(keptOthers);

  // 4c. If the fenced user content alone still overflows (even with no profile),
  //     rebuild the fenced sections within the remaining budget. `ask` first.
  let result = buildResult(profileSection, keptConversation, fencedSections);
  if (result.length > capWith(keptOthers)) {
    // User request takes precedence over grounding: 4b has shed every other profile line, so
    // `profileSection` is the fact lines or nothing. The budget is worked out against
    // BUNDLE_CHAR_CAP with an empty profile, exactly as it always was, and the fact lines are put
    // back on top: nothing is cut to make room for them, and the bundle is at most its cap.
    //
    // Reaching here means the bundle overflowed even with the FULL profile, so 4a already shed
    // both `corpus` and `conversation`. Rebuild from what SURVIVED (keptCorpus / keptConversation),
    // never from the originals — resurrecting a section the shed order just dropped would invert
    // the whole precedence this step exists to enforce.
    const shell = buildResult("", keptConversation, []); // structure, empty fenced block
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
