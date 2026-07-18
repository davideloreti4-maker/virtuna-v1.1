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

/** The shape of the inline field the loop surfaces. `none` = no field, just a confirm-to-run button. */
export type SkillInputKind = "link" | "text" | "none";

/** The skill a submitted (or button-confirmed) field runs. One key per chat-routable input skill. */
export type SkillInputAction = "remix" | "account" | "explore" | "read";

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
   * Whether the model may pass a `value` to PRE-FILL the field (text kinds only). The value is
   * model-extracted DATA the creator already stated (a niche, a concept) — still user-editable and
   * still requiring a submit tap, so it never spends money on its own. Ignored for link/none.
   */
  prefillable?: boolean;
  /** One line telling the MODEL when to request this input — fed verbatim into the tool description. */
  when: string;
}

export const SKILL_CAPABILITIES: Record<SkillInputAction, SkillCapability> = {
  remix: {
    kind: "link",
    label: "Paste the video link and I'll adapt it for your audience.",
    placeholder: "https://…",
    when:
      "the creator wants to REMIX / adapt / recreate a specific trending or competitor video but gave no link",
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
    prefillable: true,
    when:
      "the creator wants to DISCOVER outlier / trending videos to learn from (\"what's working right now\", \"show me outliers\", \"what are people posting about X\")",
  },
  read: {
    kind: "text",
    label: "What should I run past your audience?",
    placeholder: "Paste a hook, concept, or draft…",
    prefillable: true,
    when:
      "the creator wants to know how their AUDIENCE would react to a concept, hook, or draft (\"what would my audience think of…\", \"read this idea\", \"would this land\")",
  },
};

/** All chat-routable input actions — the SSOT the block schema + the request_input tool enum derive from. */
export const SKILL_INPUT_ACTIONS = Object.keys(SKILL_CAPABILITIES) as SkillInputAction[];

/** Type guard: is `x` a known input action? (Used at the loop's tool-arg boundary.) */
export function isSkillInputAction(x: unknown): x is SkillInputAction {
  return typeof x === "string" && x in SKILL_CAPABILITIES;
}
