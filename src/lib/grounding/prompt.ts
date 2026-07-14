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

/** Cap the per-beat prose so one chatty teardown cannot consume the whole budget. */
const MAX_BEATS_RENDERED = 6;
const MAX_BEAT_DESC = 70;
const MAX_EVIDENCE = 140;

/**
 * `whyItWorks` on curated rows is Sandcastles' hook_alignment + format_reasoning glued
 * together: 578 chars on average, 760 at the tail. Unclipped, ONE example consumed the
 * entire 1500-char block and the other five proven outliers were never shown to the model —
 * a grounding step that grounds on a single source is barely grounding. It also drifts into
 * their second-person coaching voice ("For your version, ensure your text overlay…"), which
 * is their product talking, not evidence. Clip to the mechanism.
 */
const MAX_WHY = 140;

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
function receipt(ex: RetrievedExample): string {
  const proven = ex.multiplier !== null && ex.multiplier >= MIN_OUTLIER_MULTIPLIER;
  const parts: string[] = [];

  if (ex.handle) parts.push(`@${ex.handle}`);

  // Below 1× the video underperformed its own account — the number would undercut the example.
  const mult = ex.multiplier !== null && ex.multiplier >= 1 ? fmtMultiplier(ex.multiplier) : "";
  if (mult) parts.push(`${mult}${ex.baselineLabel ? ` ${ex.baselineLabel}` : ""}`);

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
const WARRANT_NOTE =
  'Each is tagged "proven by" (cleared a real outlier bar — ≥3× its follower count; the number ' +
  'is shown) or "curated exemplar" (hand-picked for craft; no performance claim). Learn from ' +
  "both, but NEVER call an exemplar proven, viral, or high-performing, and never attach a " +
  "number to one.";

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
    lines.push(`${n}. ${archetype}MADLIB: ${ex.hookTemplate}`);
    if (ex.spokenHook) lines.push(`   ran as: "${ex.spokenHook}"`);
  } else if (ex.spokenHook) {
    // Honest degrade: we have the proven line but never generalized it. Say so — do not
    // dress a raw line up as a reusable template.
    lines.push(`${n}. ${archetype}proven line (no madlib extracted): "${ex.spokenHook}"`);
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

  const rendered: string[] = [];
  const used: RetrievedExample[] = [];
  let size = header.length;

  for (const ex of examples) {
    const line = render(ex, used.length + 1);
    // +2 for the blank-line join. Keep at least one example even if it alone is over budget:
    // a single over-long proof still beats silently ungrounded generation.
    if (used.length > 0 && size + line.length + 2 > CORPUS_CHAR_BUDGET) break;
    rendered.push(line);
    used.push(ex);
    size += line.length + 2;
  }

  return { corpus: `${header}\n\n${rendered.join("\n\n")}`, used };
}
