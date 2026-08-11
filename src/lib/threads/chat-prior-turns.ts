/**
 * chat-prior-turns.ts — the open-chat context anchor, with each past skill run attached to the turn
 * that announced it.
 *
 * THE DEFECT THIS EXISTS TO FIX. A dispatching chat turn persists as two-or-three message rows: the
 * cards, then the model's closing line stamped `origin:"chat-agent"`. Only `markdown` crossed into
 * the anchor, so what the model saw of its own best turn was the bare sentence "Five hooks are on
 * screen." — a claim with no visible cause anywhere in the transcript. Asked for hooks again in that
 * same thread, it did the only thing that transcript supports: reproduced the sentence and called
 * nothing. Zero cards, under a UI insisting five were on screen (confirmed live 2026-08-04).
 *
 * The sentence was the only precedent the model had, and precedent beats instruction — a prompt
 * clause was tried and failed (1/3 on the target, and it destabilised sibling chips). So the runs
 * travel with the turn instead, and `chat-agent-loop.ts` replays them as the tool-call exchange they
 * actually were.
 *
 * Lives here rather than in the route because a Next.js `route.ts` may only export HTTP methods —
 * and because this is the piece worth testing directly.
 */

import type { HydratedMessage } from "@/lib/threads/messages";
import type { ChatAgentPriorTurn } from "@/lib/tools/chat-agent-loop";

/**
 * Max prior turns to carry as context anchor.
 * D-01a soft context cap: full running context is the default; this bounds the anchor size to avoid
 * excessive token spend on very long threads.
 */
export const MAX_PRIOR_TURNS = 20;

/**
 * Which tool produced a given card — the inverse of the skill registry, used to reconstruct a past
 * turn's tool calls from the cards it left behind. Deliberately limited to what a GENERATOR emits: a
 * `corpus-references` citation or an `input-request` field is not a skill run and must never replay
 * as one. Names match `SkillTool.name` (skill-dispatch.ts); the loop ignores any that is not bound.
 */
const CARD_BLOCK_TOOL: Record<string, string> = {
  "idea-card": "generate_ideas",
  "hook-card": "generate_hooks",
  "script-card": "write_script",
};

/**
 * The one line that IDENTIFIES each card, per type — what the creator is looking at on screen.
 *
 * Carrying the count alone ("5 card(s)") was right for the replay's original job: proving a tool ran.
 * But it left the model unable to talk about its own output. Asked "Which of these hooks is strongest
 * for my audience, and why?" — a shipped follow-up chip — it answered *"I don't have the specific
 * hook lines you're referring to in front of me. Paste the 2–3 options you're debating"*, about cards
 * the app itself had just rendered (confirmed live 2026-08-04). The chip is on screen and structurally
 * unable to do its job.
 *
 * Deliberately ONE line per card, not the card: the model needs to reference and compare them, not
 * re-render them. Score bands, personas, proof and mechanism stay out — they are on screen already,
 * and every extra field is tokens on every later turn in the thread.
 */
const CARD_LINE: Record<string, (props: Record<string, unknown>) => unknown> = {
  "idea-card": (p) => p.title,
  "hook-card": (p) => p.hookLine,
  "script-card": (p) => p.title,
};

/** Per-run caps on the replayed lines — a reference, never a transcript of the whole pack. */
const MAX_LINES_PER_RUN = 6;
const MAX_LINE_LENGTH = 200;

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
  "outlier-grid": (p) => {
    const tiles = asArray(p.tiles);
    if (tiles.length === 0) return null;
    const top = tiles[0]!;
    const mult = typeof top.multiplier === "number" ? `${top.multiplier.toFixed(1)}×` : null;
    const caption = str(top.caption);
    return (
      `Explore — pulled ${tiles.length} outlier video(s)` +
      (caption ? `; top: "${caption.slice(0, 90)}"` : "") +
      (mult ? ` at ${mult} ${str(top.baselineLabel) ?? ""}`.trimEnd() : "")
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
  /**
   * The composer's card. RECORDED, not excluded, and it is the type this map matters most for: the
   * composed card exists to answer OPEN-ENDED asks, so the follow-up is always about the card
   * itself — "make the second one sharper", "why does that format work". A hole here is the exact
   * amnesia the map above was built to close, on the one card whose whole job is being referred back
   * to. It is not a `CARD_BLOCK_TOOL` replay either: `emit_card` is not a generator run.
   *
   * One line, per this module's rule: the recipe (what KIND of answer it is) and the deliverable
   * (the payoff itself, which is a typed required field, so it is always the right string to quote —
   * D6 exists so this never has to guess between a label and the answer). Slots stay out: they are
   * on screen, and every field costs tokens on every later turn.
   */
  "composed-card": (p) => {
    const deliverable = obj(p.deliverable);
    const text = deliverable ? str(deliverable.text) : null;
    if (!text) return null;
    return `${str(p.recipe) ?? "card"} — "${text.slice(0, 140)}"`;
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
const MAX_RECORDS = 12;
const MAX_RECORD_LENGTH = 240;

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

/**
 * Hydrated thread messages → the prior turns the chat agent replays, oldest→newest.
 *
 * Cards land in their own assistant row(s) immediately BEFORE the text row that announces them, so
 * walking in order and holding the cards seen since the last text/user row attributes them without a
 * join. `origin:"chat-agent"` is the confirmation, not the signal — the stamp exists for thread
 * rehydration, and is only trusted here alongside cards actually found in the rows just passed.
 *
 * WR-05 INVARIANT (unchanged): exactly ONE `markdown` block per message row, role attributed from
 * `msg.role`, so a conversational "turn" === a message and the `.slice(-MAX_PRIOR_TURNS)` cap counts
 * turns. If multi-block markdown messages are ever introduced, carry the role on the BLOCK before
 * relying on this anchor.
 */
export function openChatPriorTurns(hydratedMessages: HydratedMessage[]): ChatAgentPriorTurn[] {
  const turns: ChatAgentPriorTurn[] = [];
  // Cards seen since the last text turn — the runs the NEXT assistant text turn is announcing.
  let pendingRuns: Array<{ name: string; cards: number; lines: string[] }> = [];
  // Non-generator skill results seen since the last text turn (see SKILL_BLOCK_RECORD). They are
  // flushed as their OWN turn immediately before the next conversational turn, which puts them in
  // the transcript at the moment they actually happened — and, crucially, still emits them when no
  // text turn ever follows (a skill run from the pill persists only its card).
  let pendingRecords: string[] = [];
  // The creator's last ask, replayed as the reconstructed tool arguments (the real args were never
  // persisted; this is what the run was actually about).
  let lastUserText = "";

  const flushRecords = () => {
    if (pendingRecords.length === 0) return;
    turns.push({ role: "assistant", text: "", skillRecords: pendingRecords.slice(0, MAX_RECORDS) });
    pendingRecords = [];
  };

  for (const msg of hydratedMessages) {
    for (const block of msg.blocks) {
      const record = SKILL_BLOCK_RECORD[block.type];
      if (record && msg.role === "assistant") {
        // A skill the creator ran in this thread. Not a tool call — a record of what is on screen.
        let line: string | null = null;
        try {
          line = record(block.props as Record<string, unknown>);
        } catch {
          // A thread predating a field must never take the anchor down with it — skip the card.
          line = null;
        }
        if (line) pendingRecords.push(line.slice(0, MAX_RECORD_LENGTH));
        continue;
      }
      const tool = CARD_BLOCK_TOOL[block.type];
      if (tool && msg.role === "assistant") {
        // Cards persist one block per card, in run order — collapse a consecutive same-tool run.
        const open = pendingRuns[pendingRuns.length - 1];
        const run = open && open.name === tool ? open : null;
        if (run) run.cards++;
        else pendingRuns.push({ name: tool, cards: 1, lines: [] });
        const current = run ?? pendingRuns[pendingRuns.length - 1]!;
        // The identifying line, capped in count and length. A card whose line is missing or not a
        // string is simply counted and not quoted — never a placeholder, which would read to the
        // model as a card whose text is literally "undefined".
        const raw = CARD_LINE[block.type]?.(block.props as Record<string, unknown>);
        if (typeof raw === "string" && raw.trim() && current.lines.length < MAX_LINES_PER_RUN) {
          current.lines.push(raw.trim().slice(0, MAX_LINE_LENGTH));
        }
        continue;
      }
      if (block.type !== "markdown") continue;
      const props = block.props as { text?: unknown; origin?: unknown };
      if (typeof props.text !== "string") continue;
      const role = msg.role === "assistant" ? "assistant" : "user";
      const dispatched = role === "assistant" && props.origin === "chat-agent" && pendingRuns.length > 0;
      // Records belong BEFORE the turn that follows them — they describe work already on screen.
      flushRecords();
      turns.push({
        role,
        text: props.text,
        // `lines` is OMITTED when nothing was extractable, rather than sent as an empty array: the
        // loop then replays the byte-identical tool result it always did, so a card type with no
        // identifying line (or a pre-existing thread whose props differ) degrades to the old shape
        // instead of announcing an empty card list.
        ...(dispatched
          ? {
              toolRuns: pendingRuns.map(({ lines, ...r }) => ({
                ...r,
                topic: lastUserText,
                ...(lines.length > 0 ? { lines } : {}),
              })),
            }
          : {}),
      });
      pendingRuns = [];
      if (role === "user") lastUserText = props.text;
    }
  }
  // A skill run at the very END of the thread — the commonest shape of all, because the creator
  // taps a skill and then asks about it. Without this flush that run is the one the model cannot see.
  flushRecords();

  return turns.slice(-MAX_PRIOR_TURNS);
}
