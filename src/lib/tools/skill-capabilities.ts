/**
 * skill-capabilities.ts — the SSOT for "what a skill still needs before it can run", used by the
 * chat agent's generic `request_input` affordance.
 *
 * The chat agent (chat-agent-loop.ts) routes ALL skills. Some skills need input the creator's
 * sentence didn't supply — a video LINK to remix, a concept to read, a niche to explore — and some
 * need NOTHING (an account read resolves your own handle server-side). Instead of guessing, inventing
 * a value, or answering in prose, the model calls `request_input({ action })`; the loop looks up the
 * capability HERE to decide the field kind + the exact copy, and emits ONE `input-request` block. The
 * client renders the field inline; on submit it runs the skill's OWN dedicated route (heavy skills keep
 * their 300s budget — the chat route has none) and the result card lands in the SAME thread.
 *
 * NO model-generated UI: the model only chooses WHICH action to ask for (+ an optional prefill VALUE
 * for text fields it can already fill in from the message). The kind, label, and placeholder are set
 * HERE, deterministically — never by the model.
 *
 * Adding a skill to the chat agent = adding one entry here + one submit branch in
 * input-request-block.tsx. The `action` enum on InputRequestBlockSchema (blocks.ts) and the
 * request_input tool's enum (chat-agent-loop.ts) both derive from these keys, so they can't drift.
 */

/** The shape of the inline field the loop surfaces. `none` = no field, just a confirm-to-run button.
 *  `upload` = a video the creator has on hand (a file drop, or a video URL) — the heaviest input. */
export type SkillInputKind = "link" | "text" | "none" | "upload";

/** The skill a submitted (or button-confirmed) field runs. One key per chat-routable input skill. */
export type SkillInputAction = "remix" | "account" | "explore" | "read" | "test" | "predict" | "profile";

export interface SkillCapability {
  /** The field shape the renderer draws for this skill. */
  kind: SkillInputKind;
  /**
   * The creator-facing label — a field label for text/link kinds, the prompt line for the `none`
   * confirm card. Deterministic copy, set here (never model text) so the field can't be spoofed.
   */
  label: string;
  /** Placeholder for text/link fields (ignored for `none`). */
  placeholder?: string;
  /**
   * What a model-supplied `value` must LOOK like to PRE-FILL this field — absent when the field is
   * never prefillable (`none` has nothing to fill). The value is model-extracted DATA the creator
   * ALREADY stated in their message; it stays user-editable and still requires a submit tap, so a
   * prefill never spends money on its own.
   *
   *   "text"       — free text (a niche, a concept). Trimmed + capped; nothing else to check.
   *   "url"        — any http(s) URL. Remix takes any public video link (its route classifies it).
   *   "tiktok-url" — a TikTok video URL, the only thing /test's field will accept.
   *
   * The shape is CHECKED at the loop's tool-arg boundary (chat-agent-loop.ts): a value that does
   * not match is DROPPED and the field renders empty, so the model can never seed a field with a
   * value we already know that field will reject.
   */
  prefill?: "text" | "url" | "tiktok-url";
  /** One line telling the MODEL when to request this input — fed verbatim into the tool description. */
  when: string;
}

export const SKILL_CAPABILITIES: Record<SkillInputAction, SkillCapability> = {
  remix: {
    kind: "link",
    label: "Paste the video link and I'll adapt it for your audience.",
    placeholder: "https://…",
    // A creator who PASTED a link and asked to remix it should not have to paste it again — the
    // field opens holding the URL they already gave, one tap from running.
    prefill: "url",
    when:
      "the creator wants to REMIX / adapt / recreate a specific trending or competitor video — " +
      "pass the link as `value` when they already gave one, otherwise omit it and the field asks",
  },
  account: {
    kind: "none",
    label: "I'll read your latest posts and pull the patterns.",
    when:
      "the creator wants a read of THEIR OWN account or recent posts (\"read my account\", \"how am I doing\", \"look at my last videos\")",
  },
  explore: {
    kind: "text",
    label: "Name a niche or a competitor to scan — or leave it blank to pull your niche.",
    placeholder: "e.g. fitness coaches, @creator…",
    prefill: "text",
    when:
      "the creator wants to DISCOVER outlier / trending videos to learn from (\"what's working right now\", \"show me outliers\", \"what are people posting about X\")",
  },
  read: {
    kind: "text",
    label: "What should I run past your audience?",
    placeholder: "Paste a hook, concept, or draft…",
    prefill: "text",
    // Read is ALSO bound as a tool (`read_concept`, skill-dispatch.ts). The two doors do not
    // compete, they split on one fact: does the model have the text? With it, run the tool. Without
    // it, this field is what collects it — which is the case this `when` has to describe, or the
    // model surfaces a field the creator must fill with words they already typed.
    when:
      "the creator wants their AUDIENCE's reaction to a concept, hook or draft but has NOT given you its actual text (\"read something past my audience\", \"let me test an idea on them\") — if they already pasted the text, call read_concept instead of asking again",
  },
  predict: {
    kind: "text",
    label: "What outcome should I predict?",
    placeholder: "e.g. will this launch hit 10k signups by March?",
    prefill: "text",
    when:
      "the creator wants a FORECAST of whether a specific outcome will happen — a scenario judged by their audience panel, not a reaction to a piece of content (\"will this work\", \"what are the odds\", \"predict how this launch goes\", \"is this going to hit\")",
  },
  profile: {
    // TEXT, not upload. /api/tools/profile takes four evidence kinds (text / file_text / image /
    // video); the FILE kinds already have a shipped door — the composer's evidence drop
    // (handleProfileSubmit), which stages a clip to storage first. The text kind has no door at
    // all, and it is the one a CONVERSATION can actually fill: a pasted chat log, an email thread,
    // a call transcript. Surfacing the upload here would duplicate the staging path to reach an
    // input the creator already has a place to drop.
    kind: "text",
    label: "Paste the evidence and I'll read who they are.",
    placeholder: "A chat log, email thread, or call transcript…",
    prefill: "text",
    when:
      "the creator wants a READ OF A PERSON from real evidence — who they are, what drives them, how they will react (\"read this person\", \"what kind of buyer is this\", \"what do you make of this exchange\"). It needs the real evidence text, never a description of it; for a video or screenshot, tell them to drop the file in the composer instead",
  },
  test: {
    kind: "upload",
    label: "Drop the video (or paste its link) and I'll test it against your audience.",
    placeholder: "https://tiktok.com/…",
    // A pasted TikTok link is the ONE thing this field can be seeded with — a file drop obviously
    // cannot be. Anything that is not a TikTok URL is dropped, because the field itself rejects it.
    prefill: "tiktok-url",
    when:
      "the creator wants to TEST a real, FINISHED video they already have — score how it will perform or how their audience will react to the actual clip (\"test this video\", \"how will this do\", \"score my video\", \"rate this clip\"). This runs the full frame-by-frame video analysis, so it needs a real video FILE or a TikTok URL — never text. Pass the TikTok link as `value` when they already pasted one",
  },
};

/** All chat-routable input actions — the SSOT the block schema + the request_input tool enum derive from. */
export const SKILL_INPUT_ACTIONS = Object.keys(SKILL_CAPABILITIES) as SkillInputAction[];

/** Type guard: is `x` a known input action? (Used at the loop's tool-arg boundary.) */
export function isSkillInputAction(x: unknown): x is SkillInputAction {
  return typeof x === "string" && x in SKILL_CAPABILITIES;
}
