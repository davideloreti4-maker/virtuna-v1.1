/**
 * grounding/prompt.ts — render RetrievedExample[] into the corpus grounding block
 * that feeds assembler.corpus (§11f).
 *
 * PER-SKILL SLICES (2026-07-14). One teardown carries several different lessons; a hook
 * writer and a script writer need different ones. Until now every skill received the SAME
 * one-line-per-example summary — archetype + structure + receipt — which threw away the
 * three richest fields we store:
 *
 *   • hookTemplate (the MADLIB)  — the fill-in-the-blank skeleton a proven hook ran on.
 *     It reached the CARD (build-proof.ts) but never the MODEL. The hooks skill's entire
 *     differentiation claim is "instantiate the template that made a 44× video work", and
 *     the model was never shown the template.
 *   • idea.belief ↔ idea.reality — the tension that made the video travel. Zero readers
 *     anywhere in the codebase before today: extracted, stored, embedded, never used.
 *   • template.beats             — the timed named beats the outlier actually ran.
 *
 * Each skill now gets the slice it can act on (handoff §1E). The receipt rides along on
 * every line, so the honesty spine is unchanged: no claimed structure without a real,
 * above-baseline source behind it.
 *
 * ORDER IS A CONTRACT. Examples are rendered 1..N in array order, and the runners map the
 * model's `sourceIndex` back through that same array to build the on-card receipt
 * (build-proof.ts). Never re-order or skip an example mid-list — trim from the TAIL only,
 * and hand the caller back the trimmed list so index N always means example N.
 *
 * Pure string builder — no network, no LLM. Unit-tested.
 */

import { MIN_OUTLIER_MULTIPLIER } from "./outlier-gate";
import type { RetrievedExample, TeardownBeat } from "./types";

/** The skills that ground. (read/react score the user's own concept; chat is raw-native.) */
export type GroundingSkill = "hooks" | "ideas" | "script";

/**
 * Character budget for the whole grounding block.
 *
 * WHY THIS EXISTS: `corpus` is a fenced section inside assembleBundle's BUNDLE_CHAR_CAP
 * (4000). When the bundle overflows, the assembler drops whole PROFILE ROLES from the tail
 * first — flops, then wins, then voice. So an unbudgeted grounding block does not merely
 * get truncated; it silently EVICTS the creator's own grounding to make room for someone
 * else's proven video. That is precisely backwards: the corpus exists to make output fit
 * THIS creator, and it would have starved the fields that describe them.
 *
 * 1800 leaves room for a typical profile (~900) plus a normal ask, and fits ~4 examples after
 * the fixed header. It is a COMPROMISE, not a tuned value: the header is ~600 chars of fixed
 * overhead, so a tighter budget starves the block down to one or two sources, and a looser one
 * risks the eviction above on a long ask.
 *
 * The real fix is in the assembler, not here: when the bundle overflows it should trim the
 * CORPUS before it drops a creator's voice or wins, because the corpus is the redundant tier
 * (six proven sources still teach with four) while the profile is not (there is only one
 * creator). Until that drop-order is inverted, this cap is what stands between a fat grounding
 * block and a silently de-personalised prompt. Re-measure with BUNDLE_CHAR_CAP together
 * (audit lever A3) rather than raising this in isolation.
 */
export const CORPUS_CHAR_BUDGET = 1800;

/**
 * PER-SKILL budget. One number could not serve both shapes of grounding, and hooks paid for it.
 *
 * The block costs a ~700-char fixed header plus ~400 per example, so 1800 fits exactly TWO
 * examples. For ideas/script that is fine — their examples are near-substitutes (more of the same
 * kind of evidence), so the 3rd adds little. For hooks it is fatal: after 2026-07-14 the hooks
 * ranker returns six DIFFERENT ARCHETYPES on purpose, and each one is a distinct lesson. Capping
 * that at two does not trim redundancy, it deletes four of the six things we set out to teach —
 * silently, tail-first, with the block still looking perfectly well-formed.
 *
 * 2800 was MEASURED, not guessed, against the worst case (a fat profile + a long ask): the
 * assembled bundle lands ~3.6k against BUNDLE_CHAR_CAP (4000), so the corpus still cannot evict a
 * creator's profile roles — the hazard the comment above exists to prevent. Re-measure both
 * together if either moves.
 */
const SKILL_CHAR_BUDGET: Record<GroundingSkill, number> = {
  hooks: 2800,
  ideas: CORPUS_CHAR_BUDGET,
  script: CORPUS_CHAR_BUDGET,
};

/** The budget actually applied to a skill's block (the preview tool must not report the wrong one). */
export function corpusBudgetFor(skill: GroundingSkill): number {
  return SKILL_CHAR_BUDGET[skill];
}

/** Cap the per-beat prose so one chatty teardown cannot consume the whole budget. */
const MAX_BEATS_RENDERED = 6;
const MAX_BEAT_DESC = 70;
const MAX_EVIDENCE = 140;

/**
 * The hook lines were the ONLY unclipped fields in any renderer, and after the structural ranker
 * landed that became load-bearing. The budget is spent tail-first, so a single chatty row does not
 * merely render long — it evicts the archetypes behind it. With six DIFFERENT shapes in the block,
 * every evicted example is a distinct lesson lost, and the block still looks perfectly well-formed
 * on the way out. Measured: unclipped, a fat row collapsed a 6-archetype spread to 3.
 *
 * Bounding the two hook fields caps an example at ~500 chars, which guarantees at least 4 shapes
 * survive even the fattest rows in the corpus, and lets a typical row fit 5–6.
 */
const MAX_MADLIB = 130;
const MAX_SPOKEN = 100;

/**
 * `whyItWorks` on curated rows is Sandcastles' hook_alignment + format_reasoning glued
 * together: 578 chars on average, 760 at the tail. Unclipped, ONE example consumed the
 * entire 1500-char block and the other five proven outliers were never shown to the model —
 * a grounding step that grounds on a single source is barely grounding. It also drifts into
 * their second-person coaching voice ("For your version, ensure your text overlay…"), which
 * is their product talking, not evidence. Clip to the mechanism.
 */
const MAX_WHY = 120;

function fmtViews(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "?";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** A non-positive multiplier is a missing measurement, not a 0× result — never print it. */
function fmtMultiplier(m: number | null): string {
  if (m === null || !Number.isFinite(m) || m <= 0) return "";
  return m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** Trim to a hard length without leaving a dangling half-word. */
function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The receipt — and, more importantly, the CLAIM the receipt is allowed to make.
 *
 * The corpus holds two kinds of row and they are proof of different things:
 *
 *  • Cleared the §12 bar (≥3× views÷followers) → a genuine outlier. Say "proven by", show
 *    the multiplier. This is the strong receipt and the thing the creator cannot get elsewhere.
 *
 *  • Everything else → a CURATED EXEMPLAR: hand-picked by Sandcastles into a teaching
 *    collection because it demonstrates the craft. That is a real warrant, and it is why these
 *    rows are admitted (owner call) — but it is NOT an outlier claim, and we must not dress it
 *    as one. Half the TikTok library has no score at all, and 20 videos scored BELOW 1× (fewer
 *    views than the account has followers — they underperformed). "Proven by @x · 0.5× vs
 *    followers" refutes itself in its own sentence.
 *
 * So the multiplier is printed only where it SUPPORTS the line: at ≥1× it is a real result
 * worth stating; below 1× or absent it proves nothing and is omitted rather than spun.
 */
/**
 * "Proven" is a sentence with two halves — "cleared ≥3× ITS FOLLOWER COUNT" — and we may only say
 * it when BOTH are true. A multiplier with no recorded baseline (the entire curated corpus: 0 of
 * 532 rows carry a follower_count) satisfies the first half and invents the second. Such a row is
 * an EXEMPLAR: its warrant is that a human picked it, which is real, and it teaches perfectly well
 * without a performance claim it cannot support.
 *
 * The score is still SHOWN — it is genuine source data and the owner's call is to keep it — but it
 * is named for what it is ("outlier score", the source's own metric) rather than dressed up as a
 * follower ratio we never measured.
 */
function receipt(ex: RetrievedExample): string {
  // A baseline label survives retrieval only when the row can actually back it (hasFollowerBaseline),
  // so its presence IS the signal that the number means something. No baseline → NO NUMBER: a bare
  // "20154×" in the prompt is not a neutral fact, it is a boast with nothing behind it, and it is
  // exactly what let a fabricated follower ratio read as proof. The score is not lost — it still
  // ranks the corpus (rank.ts) and still reaches the card — it just stops making a claim here.
  const baselined = Boolean(ex.baselineLabel);
  const proven = baselined && ex.multiplier !== null && ex.multiplier >= MIN_OUTLIER_MULTIPLIER;
  const parts: string[] = [];

  if (ex.handle) parts.push(`@${ex.handle}`);

  // Below 1× the video underperformed its own account — the number would undercut the example.
  if (baselined && ex.multiplier !== null && ex.multiplier >= 1) {
    parts.push(`${fmtMultiplier(ex.multiplier)} ${ex.baselineLabel}`);
  }

  parts.push(`${fmtViews(ex.views)} views`);

  const body = parts.join(" · ");
  return proven ? `proven by ${body}` : `curated exemplar — ${body}`;
}

/** "Topic Introduction (0–4s) state the comparison" — a proven beat, timed. */
function fmtBeat(b: TeardownBeat): string {
  const timing =
    b.startSec !== null && b.endSec !== null ? ` (${b.startSec}–${b.endSec}s)` : "";
  const desc = b.description ? ` ${clip(b.description, MAX_BEAT_DESC)}` : "";
  return `${b.name}${timing}${desc}`;
}

// ─── Headers: what the model is being asked to DO with the slice ─────────────

/**
 * Every example carries ONE of two warrants, and the header says so explicitly. The model
 * writes prose the creator reads ("mechanism", "whyItFits"), so if the header claims all of
 * these are proven outliers, the model will happily repeat that about a video that
 * underperformed. The distinction has to reach the model, not just the renderer.
 */
/**
 * Every word here is paid for out of the example budget — it is ~1/4 of the block, and each 400
 * chars of header is one proven source the model never sees. Keep the two LOCKED rules (an exemplar
 * is never "proven"; a multiplier never travels without its basis) and cut everything else.
 */
const WARRANT_NOTE =
  'Tagged "proven by" (beat a named baseline by ≥3× — number AND basis are both shown, e.g. ' +
  '"44× vs their usual views") or "curated exemplar" (hand-picked for craft; never measured, so it ' +
  "carries no number). Learn craft from both. NEVER call an exemplar proven, viral, or " +
  "high-performing; never attach a number to one; never repeat a multiplier without its basis.";

const HEADERS: Record<GroundingSkill, string> = {
  hooks:
    "GROUNDING — real short-form hooks, torn down. Each MADLIB is the reusable skeleton the " +
    "hook ran on. INSTANTIATE the madlib for THIS creator — fill its [brackets] with their " +
    "topic, their specifics, their voice. Borrow the STRUCTURE, never the source's words, " +
    "examples, or subject. " +
    WARRANT_NOTE +
    " Tag each hook with the sourceIndex (1-N) of the example it instantiates, or 0 if none — " +
    "never cite a source you did not use.",
  ideas:
    "GROUNDING — real short-form videos torn into the IDEA that carried them. Each names the " +
    "BELIEF its audience held and the REALITY that contradicted it: that tension is what gives " +
    "the video its pull. Build ideas that create the SAME KIND of tension for THIS creator's " +
    "audience and subject — do NOT reuse the source's topic. " +
    WARRANT_NOTE +
    " Tag each idea with the sourceIndex (1-N) whose tension it borrows, or 0 if none — never " +
    "cite a source you did not use.",
  script:
    "GROUNDING — real short-form videos torn into the BEAT STRUCTURE they actually ran, with " +
    "timings measured from the video. This is evidence of what pacing holds attention on this " +
    "kind of story. Map your Hook → Setup → Turn → Payoff → CTA onto that rhythm — borrow the " +
    "PACING and the shape of each beat, never the source's content. " +
    WARRANT_NOTE +
    " Tag the script with the sourceIndex (1-N) whose structure it adapts, or 0 if none — never " +
    "cite a source you did not use.",
};

// ─── Per-skill example renderers ────────────────────────────────────────────

/** HOOKS — the madlib leads. It is the thing the creator cannot get from a chat box. */
function renderHooks(ex: RetrievedExample, n: number): string {
  const archetype = ex.hookArchetype ? `[${ex.hookArchetype}] ` : "";
  const lines: string[] = [];

  if (ex.hookTemplate) {
    lines.push(`${n}. ${archetype}MADLIB: ${clip(ex.hookTemplate, MAX_MADLIB)}`);
    if (ex.spokenHook) lines.push(`   ran as: "${clip(ex.spokenHook, MAX_SPOKEN)}"`);
  } else if (ex.spokenHook) {
    // Honest degrade: we have the proven line but never generalized it. Say so — do not
    // dress a raw line up as a reusable template.
    lines.push(
      `${n}. ${archetype}proven line (no madlib extracted): "${clip(ex.spokenHook, MAX_SPOKEN)}"`,
    );
  } else {
    lines.push(`${n}. ${archetype}structure: ${ex.template?.name ?? "(unnamed)"}`);
  }

  if (ex.whyItWorks) lines.push(`   works because: ${clip(ex.whyItWorks, MAX_WHY)}`);
  // `receipt` supplies its own lead-in — "proven by" or "curated exemplar —" — because only it
  // knows which warrant this row earned. Do NOT prepend one here.
  lines.push(`   ${receipt(ex)}`);
  return lines.join("\n");
}

/** IDEAS — the belief↔reality tension leads. */
function renderIdeas(ex: RetrievedExample, n: number): string {
  const format = ex.format ? ` [${ex.format}]` : "";
  const topic = ex.idea?.topic || ex.idea?.seed || ex.spokenHook || "(untitled)";
  const lines: string[] = [`${n}. ${clip(topic, 90)}${format}`];

  if (ex.idea?.belief) lines.push(`   audience believed: ${clip(ex.idea.belief, 130)}`);
  if (ex.idea?.reality) lines.push(`   reality: ${clip(ex.idea.reality, 130)}`);
  if (ex.idea?.evidence) lines.push(`   evidence: ${clip(ex.idea.evidence, MAX_EVIDENCE)}`);
  if (ex.idea?.angle) lines.push(`   angle: ${clip(ex.idea.angle, 110)}`);
  if (!ex.idea && ex.whyItWorks) lines.push(`   works because: ${clip(ex.whyItWorks, MAX_WHY)}`);

  // `receipt` supplies its own lead-in — "proven by" or "curated exemplar —" — because only it
  // knows which warrant this row earned. Do NOT prepend one here.
  lines.push(`   ${receipt(ex)}`);
  return lines.join("\n");
}

/** SCRIPT — the timed named beats lead; guidance says WHEN the structure applies. */
function renderScript(ex: RetrievedExample, n: number): string {
  const format = ex.format ? ` [${ex.format}]` : "";
  const name = ex.template?.flavor || ex.template?.name || ex.hookArchetype || "(structure)";
  const lines: string[] = [`${n}. ${clip(name, 90)}${format}`];

  const beats = ex.template?.beats ?? [];
  if (beats.length > 0) {
    const shown = beats.slice(0, MAX_BEATS_RENDERED).map(fmtBeat).join(" → ");
    const more = beats.length > MAX_BEATS_RENDERED ? ` → …(+${beats.length - MAX_BEATS_RENDERED})` : "";
    lines.push(`   beats: ${shown}${more}`);
  } else if (ex.template?.skeleton?.length) {
    // Untimed fallback — our own text-tier extractor cannot see the video clock.
    lines.push(`   beats (untimed): ${ex.template.skeleton.join(" → ")}`);
  }

  if (ex.template?.guidance) lines.push(`   use when: ${clip(ex.template.guidance, 150)}`);
  if (ex.spokenHook) lines.push(`   opened with: "${clip(ex.spokenHook, 100)}"`);

  // `receipt` supplies its own lead-in — "proven by" or "curated exemplar —" — because only it
  // knows which warrant this row earned. Do NOT prepend one here.
  lines.push(`   ${receipt(ex)}`);
  return lines.join("\n");
}

const RENDERERS: Record<GroundingSkill, (ex: RetrievedExample, n: number) => string> = {
  hooks: renderHooks,
  ideas: renderIdeas,
  script: renderScript,
};

// ─── The block ───────────────────────────────────────────────────────────────

export interface CorpusBlock {
  /** Formatted grounding block for AssemblerInput.corpus — undefined when nothing rendered. */
  corpus: string | undefined;
  /**
   * The examples actually RENDERED, in order. The caller must hand THIS list to the runner,
   * not the input list: the model can only cite what it was shown, and `sourceIndex` is
   * resolved positionally against this array.
   */
  used: RetrievedExample[];
}

/**
 * Build the per-skill grounding block, trimming from the TAIL to stay inside
 * CORPUS_CHAR_BUDGET so the block can never evict the creator's own profile from the
 * bundle. Returns the rendered examples alongside the text so `sourceIndex` stays exact.
 */
export function buildCorpusBlock(
  examples: RetrievedExample[],
  skill: GroundingSkill,
): CorpusBlock {
  if (examples.length === 0) return { corpus: undefined, used: [] };

  const render = RENDERERS[skill];
  const header = HEADERS[skill];
  const budget = SKILL_CHAR_BUDGET[skill];

  const rendered: string[] = [];
  const used: RetrievedExample[] = [];
  let size = header.length;

  for (const ex of examples) {
    const line = render(ex, used.length + 1);
    // +2 for the blank-line join. Keep at least one example even if it alone is over budget:
    // a single over-long proof still beats silently ungrounded generation.
    if (used.length > 0 && size + line.length + 2 > budget) break;
    rendered.push(line);
    used.push(ex);
    size += line.length + 2;
  }

  return { corpus: `${header}\n\n${rendered.join("\n\n")}`, used };
}
