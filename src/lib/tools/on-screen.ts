/**
 * on-screen.ts — what a skill run put on the creator's screen, as text the model can reference.
 *
 * Two describer maps, one per shape: `CARD_LINE` for a generator PACK (the identifying line of each
 * card) and `SKILL_BLOCK_RECORD` for every other skill's RESULT (one compact summary line). Both
 * feed two seams — the live tool result and the replayed context record — and that is the point.
 *
 * ─── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────────────────────
 *
 * The same extraction is needed at two seams that had drifted apart for a week:
 *
 *   · `chat-prior-turns.ts`  — rebuilding a PAST turn's tool result when a thread is replayed.
 *     Added 2026-08-04 because the count alone left the model unable to discuss its own output:
 *     asked "Which of these hooks is strongest?" — a shipped follow-up chip — it answered *"I
 *     don't have the specific hook lines you're referring to in front of me. Paste the 2–3
 *     options you're debating"*, about cards the app had just rendered.
 *
 *   · `chat-agent-loop.ts`   — the LIVE tool result, on the turn the cards are actually made.
 *     This one was never given the lines. Measured consequence, 2/2 walks (2026-08-11): the model
 *     narrated an enumerated pack of 10 and then 5 hooks with ZERO overlap with the cards
 *     rendered beside them. It knows five cards exist, cannot see them, is asked for hooks, and
 *     is told in prose not to restate what it cannot read — so it writes new ones. That is not
 *     misbehaviour; it is the only output available to it.
 *
 * The replayed path being right while the live path was blind is the worst possible split: the
 * model can discuss a pack it made LAST turn and not the one it just made. Keeping the map, the
 * caps and the extraction in one module is what stops a third seam from being added blind.
 *
 * ─── WHY ONE LINE AND NOT THE CARD ───────────────────────────────────────────────────────────
 *
 * The model needs to REFERENCE and COMPARE the cards, not re-render them. Score bands, personas,
 * proof and mechanism stay out: they are on screen already, and every extra field is tokens on
 * every later turn in the thread.
 *
 * ⚠️ Do not read this as licence to hand card lines to a GENERATOR. Handing `cardsOnScreen` to the
 * hooks pipeline under "do not reproduce these" made it reproduce them, one verbatim in ten
 * (session 8 §12.1, removed in `8e27709a`). The consumer here is the NARRATOR, whose job is to
 * talk about lines that already exist — the opposite job, with the opposite failure mode.
 *
 * Pure, no I/O. Deterministic.
 */

/**
 * DEFAULT ON (2026-08-11). Set `ENGINE_CHAT_CARDS_ON_SCREEN="false"` to disable — the same
 * kill-switch shape `CHAT_AGENT_DISPATCH` ships with.
 *
 * It shipped dark for exactly as long as it took to run the arm. The one measured reason to expect
 * it to backfire was §12.1 — handing card lines to the GENERATOR under a do-not-reproduce
 * instruction made it reproduce them, one verbatim in ten. That did not transfer: 0/12 re-listing
 * across the A/B, because the narrator is the opposite consumer with the opposite job. What did
 * change is categorical — 0/12 → 9/12 runs that name a real card by its text, and arm A is
 * structurally incapable of it.
 *
 * The replay path has never been gated; it has carried these lines since 2026-08-04. The flag only
 * ever covered the live half.
 *
 * Server-side (no `NEXT_PUBLIC_`): nothing about it reaches the client.
 */
export function isChatCardsOnScreenEnabled(): boolean {
  return process.env.ENGINE_CHAT_CARDS_ON_SCREEN !== "false";
}

/**
 * The identifying line per card type — what the creator is actually looking at.
 *
 * Deliberately limited to what a GENERATOR emits. A `corpus-references` citation, a `run-header`
 * or an `input-request` field is not a card the creator can be pointed at.
 */
export const CARD_LINE: Record<string, (props: Record<string, unknown>) => unknown> = {
  "idea-card": (p) => p.title,
  "hook-card": (p) => p.hookLine,
  "script-card": (p) => p.title,
};


// ─── The rest of the thread — every OTHER skill's output ─────────────────────
/**
 * THE SECOND HALF OF THE SAME DEFECT (owner-reported 2026-08-04, then measured).
 *
 * The map above covers the three GENERATORS, because those are the skills the agent itself can
 * call. But the open thread is shared by every skill: a Test, an account read, an Explore, a
 * Read, a Remix and a Predict all persist their cards into the SAME thread the chat agent reads.
 * None of them is `markdown` and none is in `CARD_BLOCK_TOOL`, so the walk below skipped them
 * entirely — the model saw a conversation with holes where the creator's actual work had been.
 *
 * Measured across every open thread in the project: 107 of 982 persisted blocks (11%) were
 * invisible, and they were precisely the non-generator skills. The creator's experience of that
 * is exact: run a Test, ask "so what should I fix first?", and the co-pilot has never heard of it.
 *
 * Worse than a hole: a skill run from the PILL persists ONLY its card — no text row follows it —
 * so those runs produced no turn at all, not even an empty one.
 *
 * These are NOT replayed as tool calls. The agent did not call them and (mostly) cannot; naming
 * them as tools would advertise a door that does not exist — the same rule `replayPriorTurn`
 * already applies to an unbound generator. They ride as a plain CONTEXT RECORD instead: one line
 * per card saying what is on the creator's screen, which is the sanctioned degradation path.
 *
 * One line each, deliberately. The model needs to REFERENCE this work, not re-render it; every
 * extra field is tokens on every later turn in the thread.
 */
const SKILL_BLOCK_RECORD: Record<string, (props: Record<string, unknown>) => string | null> = {
  "multi-audience-read": (p) => {
    const auds = asArray(p.audiences);
    if (auds.length === 0) return null;
    const parts = auds.map((a) => {
      const name = str(a.name) ?? "audience";
      const band = str(a.band) ?? "";
      const frac = str(a.fraction) ?? "";
      const lever = str(a.lever);
      return `${name}: ${band}${frac ? ` (${frac})` : ""}${lever ? ` — lever: ${lever}` : ""}`;
    });
    return `Audience Read — ${parts.join(" · ")}`;
  },
  /**
   * ⚠️ THE ONE RECORD THAT SUMMARISES A SET. Every other describer above condenses a single result,
   * so "one line each" and "one result each" are the same rule for them. The Explore grid puts
   * TWELVE videos on the creator's screen, and this described `tiles[0]` — so the agent was told
   * one video existed and eleven did not. "Find me 3 viral formats", an ask the grid on screen
   * fully answers, was unanswerable for a purely mechanical reason (fixed 2026-08-15).
   *
   * It still emits ONE line. That line now quotes up to MAX_GRID_TILES of them, and prints BOTH
   * counts: a record that quoted 5 of 12 while saying only "12" would invite the model to describe
   * seven videos it was never shown.
   */
  "outlier-grid": (p) => {
    const tiles = asArray(p.tiles);
    if (tiles.length === 0) return null;
    const quoted = tiles.slice(0, MAX_GRID_TILES);
    const parts = quoted.map((t) => {
      const caption = str(t.caption);
      const mult = typeof t.multiplier === "number" ? `${t.multiplier.toFixed(1)}×` : null;
      const label = str(t.baselineLabel);
      // The baseline rides on EVERY tile rather than being stated once up front: a single header
      // would be a uniformity claim over rows this describer never compared, and the corpus does
      // carry mixed bases ("vs own" / "vs their usual views").
      return (
        `"${caption ? caption.slice(0, GRID_CAPTION_LENGTH) : "untitled"}"` +
        (mult ? ` ${mult}${label ? ` ${label.slice(0, 24)}` : ""}` : "")
      );
    });
    return (
      `Explore — pulled ${tiles.length} outlier video(s), quoting ${quoted.length}: ` +
      parts.join(" · ")
    );
  },
  "profile-read": (p) => {
    const identity = obj(p.identity);
    const traits = identity ? asStrings(identity.traits).slice(0, 4).join(", ") : "";
    const how = str(p.howTheyReact);
    return (
      `Account/Profile Read — ${str(p.subjectName) ?? "subject"}` +
      (traits ? ` (${traits})` : "") +
      (how ? `; how they react: ${how.slice(0, 140)}` : "")
    );
  },
  "video-test-card": (p) => {
    const score = typeof p.craftScore === "number" ? `craft ${p.craftScore}/100` : "craft score unavailable";
    const fixes = asArray(p.fixes)
      .map((f) => str(f.title))
      .filter((x): x is string => !!x)
      .slice(0, 3);
    const drop = str(p.dropLabel);
    return (
      `Video Test — ${score}` +
      (drop ? `; weak beat at ${drop}` : "") +
      (fixes.length > 0 ? `; fixes: ${fixes.join(" / ")}` : "")
    );
  },
  "remix-card": (p) => {
    const hook = str(p.adaptedHook);
    const band = str(p.band);
    const frac = str(p.fraction);
    return (
      `Remix — adapted hook: "${(hook ?? "").slice(0, 120)}"` +
      (band ? `; ${band}${frac ? ` (${frac})` : ""}` : "")
    );
  },
  "reaction-distribution": (p) => {
    const who = str(p.audienceName) ?? "audience";
    const stim = str(p.stimulus);
    const read = obj(p.read);
    const verdict = read ? str(read.verdict) : null;
    const band = str(p.band);
    const frac = str(p.fraction);
    const outcome = verdict ?? `${band ?? ""}${frac ? ` (${frac})` : ""}`.trim();
    return `Audience reaction — ${who}${stim ? ` on "${stim.slice(0, 90)}"` : ""}${outcome ? `: ${outcome}` : ""}`;
  },
  "prediction-gauge": (p) => {
    const range = obj(p.range);
    const span =
      range && typeof range.min === "number" && typeof range.max === "number"
        ? ` (${range.min}–${range.max}%)`
        : "";
    return (
      `Prediction — ${str(p.scenario)?.slice(0, 110) ?? "scenario"}: ` +
      `${str(p.band) ?? ""}${span}${str(p.confidence) ? `, ${str(p.confidence)} confidence` : ""}`
    );
  },
  "account-read": (p) => {
    const handle = str(p.handle) ?? "your account";
    if (p.fallback === "thin") return `Account Read — ${handle}: too little history to read yet`;
    const vids = asArray(p.analyzedVideos).length;
    const patterns = obj(p.patterns);
    // Patterns is a nested shape that has changed shape over time; take whatever string list is
    // on it rather than naming a field a older block may not carry.
    const firstPattern = patterns
      ? asStrings(Object.values(patterns).find((v) => Array.isArray(v) && v.some((e) => typeof e === "string")))[0]
      : undefined;
    return (
      `Account Read — ${handle}` +
      (vids > 0 ? `, ${vids} recent post(s) analysed` : "") +
      (firstPattern ? `; pattern: ${firstPattern.slice(0, 120)}` : "")
    );
  },
  "brought-card": (p) => {
    const band = str(p.band);
    const frac = str(p.fraction);
    return (
      `Audience reaction to a ${str(p.kind) ?? "draft"}` +
      (str(p.stimulus) ? ` ("${str(p.stimulus)!.slice(0, 90)}")` : "") +
      `${str(p.lens) ? ` — would ${str(p.lens)}` : ""}: ${band ?? ""}${frac ? ` (${frac})` : ""}`
    );
  },
  /**
   * The composer's card. RECORDED, not excluded, and it is the type this map matters most for: the
   * composed card exists to answer OPEN-ENDED asks, so the follow-up is nearly always about the card
   * itself — "make the second one sharper", "why does that format work". A hole here is the exact
   * amnesia this module was built to close, on the one card whose whole job is being referred back
   * to. Not a `CARD_LINE` replay either: `emit_card` is free and is not a generator run.
   *
   * One line, per this module's rule: the recipe (what KIND of answer it is) and the deliverable
   * (the payoff itself — a typed required field, so it is always the right string to quote; D6
   * exists so this never has to guess between a label and the answer). Slots stay out: they are on
   * screen already, and every field costs tokens on every later turn in the thread.
   */
  "composed-card": (p) => {
    const deliverable = obj(p.deliverable);
    const text = deliverable ? str(deliverable.text) : null;
    if (!text) return null;
    return `${str(p.recipe) ?? "card"} — "${text.slice(0, 140)}"`;
  },
};

/** Every block type that becomes a context record — the SSOT the drift test asserts against. */
export const RECORDED_BLOCKS = Object.keys(SKILL_BLOCK_RECORD);

/**
 * Block types that are deliberately NOT context records, and why. Kept as an explicit list rather
 * than an implicit "everything else" so the reachability drift test can assert that every block a
 * skill can persist is either replayed, recorded, or knowingly excluded here.
 */
export const NON_RECORD_BLOCKS: Record<string, string> = {
  markdown: "the conversation itself — replayed as a turn",
  "idea-card": "a generator's card — replayed as a tool run",
  "hook-card": "a generator's card — replayed as a tool run",
  "script-card": "a generator's card — replayed as a tool run",
  "run-header": "UI chrome (the run capsule's title), carries no result",
  "input-request": "an inline FIELD awaiting the creator, not a result — recording it would read as an answer",
  "corpus-references": "a citation the model itself produced in the turn it is attached to",
  "persona-chat-turn": "the persona sub-thread — replayed on its own anchor, never mixed into open chat",
  // Sub-blocks of a card, never a run on their own: whichever card carries them is already
  // recorded above with its band/fraction, so recording these too would double-count one result.
  band: "a sub-block of a card whose own record already carries the band",
  personas: "a sub-block of a card whose own record already carries the result",
};

/** Caps on the record trail: compact by construction, since it rides on every later turn. */
export const MAX_RECORDS = 12;
/**
 * ⚠️ RAISED 240 → 650 on 2026-08-15, and it is one decision with MAX_GRID_TILES, not two. A cap
 * that clips below the line the describer intends to emit does not save tokens — it hands the model
 * a caption cut mid-word, which it then reads back to the creator as a video title. At 240 the grid
 * record could not have quoted more than two tiles no matter what the describer did.
 *
 * This is a SAFETY bound, not a budget: every other describer above lands well under 240 and is
 * unaffected. The grid is the only record that summarises a set, and its worst case (5 tiles ×
 * 80-char caption + multiplier + a 24-char baseline) is ~630.
 */
export const MAX_RECORD_LENGTH = 650;
/** How many of an Explore grid's tiles one record quotes. Twelve is the pull; five is the quote. */
export const MAX_GRID_TILES = 5;
/** Per-tile caption budget inside that record — enough to identify a format, not to re-render it. */
const GRID_CAPTION_LENGTH = 80;

/** Is this block type one the describers above know how to summarise? */
export function isRecordedBlock(blockType: string): boolean {
  return blockType in SKILL_BLOCK_RECORD;
}

/**
 * The one-line record for ONE result block, or null when it is not a recordable result.
 *
 * ⚠️ The describers read nested props (`patterns`, `range`, `read`, `identity`) whose shapes have
 * changed over time, so a throw is a live possibility. It is caught HERE rather than at each call
 * site: the replay path guarded it (a thread predating a field must not take the whole anchor
 * down), and the live path needs the same guarantee for a harder reason — by the time this runs
 * the creator has been BILLED and the cards are already on their screen, so a describer throwing
 * must degrade the tool result, never the turn.
 */
export function recordLineOf(blockType: string, props: unknown): string | null {
  const describe = SKILL_BLOCK_RECORD[blockType];
  if (!describe) return null;
  let line: string | null = null;
  try {
    line = describe((props ?? {}) as Record<string, unknown>);
  } catch {
    return null;
  }
  return line && line.trim() ? line.trim().slice(0, MAX_RECORD_LENGTH) : null;
}

// Small prop readers — persisted blocks are re-validated on load, but a thread can predate any
// given field, so every read degrades to null rather than throwing or printing "undefined".
function str(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}
function obj(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}
function asArray(x: unknown): Array<Record<string, unknown>> {
  return Array.isArray(x) ? x.filter((e): e is Record<string, unknown> => !!e && typeof e === "object") : [];
}
function asStrings(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : [];
}

/** Per-run caps on the quoted lines — a reference, never a transcript of the whole pack. */
export const MAX_LINES_PER_RUN = 6;
export const MAX_LINE_LENGTH = 200;

/**
 * The identifying line of ONE card block, or null.
 *
 * Null — never a placeholder — when the card carries no line, or carries a non-string. A
 * placeholder would read to the model as a card whose text is literally "undefined", and a thread
 * predating a field must degrade to "counted, not quoted" rather than announcing a phantom card.
 */
export function cardLineOf(blockType: string, props: unknown): string | null {
  const read = CARD_LINE[blockType];
  if (!read) return null;
  const raw = read((props ?? {}) as Record<string, unknown>);
  if (typeof raw !== "string") return null;
  const line = raw.trim();
  return line ? line.slice(0, MAX_LINE_LENGTH) : null;
}

/**
 * The identifying lines of one run's blocks, in card order, capped in count and length.
 *
 * Returns an EMPTY array when nothing is extractable, and both callers treat that as "omit the
 * field entirely" rather than sending `[]` — an empty card list is a claim, and the wrong one.
 */
/**
 * Read ONE block through `read`, containing anything it throws.
 *
 * The guard is here, around the whole per-block read, rather than only inside the describers.
 * Live, this code runs AFTER the creator has been billed and AFTER their cards are on screen, so
 * there is no failure worth propagating: the worst honest outcome is a tool result that falls back
 * to the count. Narrower guards keep being defeated by the part nobody thought of — the first
 * version of this caught throws inside the describer and was defeated by reading `.props`.
 */
function describeBlock(
  block: unknown,
  read: (type: string, props: unknown) => string | null,
): string | null {
  try {
    const b = block as { type?: unknown; props?: unknown };
    if (typeof b?.type !== "string") return null;
    return read(b.type, b.props);
  } catch {
    return null;
  }
}

export function extractCardLines(blocks: readonly unknown[]): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    if (lines.length >= MAX_LINES_PER_RUN) break;
    const line = describeBlock(block, cardLineOf);
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * WHAT A RUN PUT ON THE CREATOR'S SCREEN — for ANY skill, not just the three generators.
 *
 * The live tool result used to describe a run as `produced: "N card(s)"`. Handing back the
 * generator LINES fixed hooks/ideas/script, and left every other bound skill exactly as blind:
 * `read_concept` returns a `multi-audience-read`, so the agent could run a creator's draft past
 * their audience and then narrate the verdict without being able to read it. Same defect, higher
 * stakes — a narrated verdict can CONTRADICT the card beside it, not merely duplicate it.
 *
 * So the describer is keyed off the block, not off a hardcoded list of generators:
 *
 *   `cards`   a generator pack — the identifying line of each card, in order. The creator is
 *             choosing between them, so the model needs to compare and name one.
 *   `results` any other skill's output — one compact summary line per block, the SAME line the
 *             replay path has recorded since 2026-08-04 (`SKILL_BLOCK_RECORD`). The creator is
 *             reading a verdict, so the model needs to build on it and not restate or contradict it.
 *
 * Cards win a mixed run: a pack is what the creator is looking at, and `run-header` chrome is
 * excluded from both maps anyway. Returns null when nothing is describable, which both callers
 * treat as "omit the field" — an empty list is a claim, and the wrong one.
 */
export type RunOutputSummary =
  | { kind: "cards"; lines: string[] }
  | { kind: "results"; lines: string[] };

export function describeRunOutput(blocks: readonly unknown[]): RunOutputSummary | null {
  const cards = extractCardLines(blocks);
  if (cards.length > 0) return { kind: "cards", lines: cards };

  const results: string[] = [];
  for (const block of blocks) {
    if (results.length >= MAX_LINES_PER_RUN) break;
    const line = describeBlock(block, recordLineOf);
    if (line) results.push(line);
  }
  return results.length > 0 ? { kind: "results", lines: results } : null;
}
