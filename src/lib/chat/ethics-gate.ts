/**
 * ethics-gate.ts — Realtime backstop for the Chase Hughes behavioral layer.
 *
 * ⚠️ STATUS: DEACTIVATED / DORMANT (2026-06-12). This module is fully built, tested (58 unit
 * tests), and red-team-validated (scripts/ethics-gate-eval.ts → 0/12 leaks, 0/3 over-refusals),
 * but it is NOT wired into any live path. The chat route and seed-context.ts do not import it.
 * Deferred by decision — relying on Qwen's built-in safety for now. Re-wire when the Chase Hughes
 * behavioral corpus (Track A/B) actually goes user-facing. To reactivate: inject
 * buildEthicsPromptBlock() into seed-context.ts and wrap the chat stream with gateAsyncDeltas().
 *
 * This is ONE of three enforcement tiers (see .planning/corpus/ETHICS-GATE-SPEC.md §1.5):
 *   1. Prompt prevention (primary)  — lives in the chat system prompt; prevents generation.
 *   2. Realtime tripwire (THIS FILE) — halts a stream if the model coaches an EXCLUDE tactic.
 *   3. Offline eval (deployment gate) — LLM-judge red-team on stored transcripts.
 *
 * SCOPE & LIMITS (read before trusting this):
 *   - This is a HIGH-PRECISION / LOW-RECALL backstop, NOT a semantic guarantee. It trips only
 *     when a named EXCLUDE tactic co-occurs with prescriptive/imperative framing in the same
 *     sentence. Paraphrase evades it by design — that is acceptable, because the prompt is the
 *     primary defense and the offline judge is the real semantic check.
 *   - It MUST NOT block legitimate *detection* of these tactics in others' content. Per the spec,
 *     "this funnel uses a manufactured-dependency close" is permitted audit output; only the
 *     coaching form ("use a manufactured-dependency close to…") trips. The prescriptive-framing
 *     requirement is what separates the two.
 *
 * Source of truth for the 14 EXCLUDE items: ETHICS-GATE-SPEC.md §3 (register rows in
 * _CRITIC-REPORT.md Part 2). This registry is also consumed by the prompt builder and eval harness.
 */

// ── EXCLUDE registry (the 14 hard-blocked tactics) ──────────────────────────

export interface ExcludeItem {
  /** Spec §3 row number (1–14). */
  id: number;
  /** Human name, matches ETHICS-GATE-SPEC.md §3. */
  name: string;
  /** Named-tactic detectors. A match here is necessary but NOT sufficient to trip. */
  tacticPatterns: RegExp[];
}

/**
 * The 14 EXCLUDE tactics. `tacticPatterns` target the specific named mechanic — phrases
 * unlikely to appear in ordinary creator chat. Tripping additionally requires prescriptive
 * framing (see `PRESCRIPTIVE_FRAMING`), so descriptive/audit mentions do not fire.
 */
export const EXCLUDE_REGISTRY: readonly ExcludeItem[] = [
  {
    id: 1,
    name: "Childhood-wound contract",
    tacticPatterns: [
      /childhood (wound|trauma)/i,
      /attachment (wound|trauma)/i,
      /reach(ing)? (in|into) .{0,30}(trauma|nervous system|wound)/i,
    ],
  },
  {
    id: 2,
    name: "Regression induction",
    tacticPatterns: [
      /regress(ion|ing|ive)?\b.{0,40}(viewer|audience|them|listener|adult|state)/i,
      /induce .{0,20}regression/i,
      /(childhood|earlier) (memory|state).{0,30}bypass/i,
    ],
  },
  {
    id: 3,
    name: "Presupposition stack / confabulated memory",
    tacticPatterns: [
      /confabulat/i,
      /presuppos\w+.{0,30}(memory|happened|experience)/i,
      /(implant|plant|fabricate|manufacture) .{0,20}(false )?(memory|memories|experience)/i,
    ],
  },
  {
    id: 4,
    name: "Voluntary confession / confession architecture",
    tacticPatterns: [
      /confession architecture/i,
      /cost[- ]of[- ]silence/i,
      /(make|get) (them|people|the (viewer|audience)) .{0,20}confess/i,
    ],
  },
  {
    id: 5,
    name: "Identity statement elicitation / social-introduction seal",
    tacticPatterns: [
      /consistency trap/i,
      /identity (statement|lock).{0,30}(elicit|seal|trap)/i,
      /lock (their|the viewer'?s?|the audience'?s?) identity/i,
    ],
  },
  {
    id: 6,
    name: "Gradual interspersed agreement",
    tacticPatterns: [
      /interspersed agreement/i,
      /(gradual|drip).{0,30}agreement.{0,30}(conversation|casual)/i,
      /string of (small )?yes(es|s)?\b.{0,30}without (them )?notic/i,
    ],
  },
  {
    id: 7,
    name: "Negative offcasting",
    tacticPatterns: [/negative off-?casting/i, /off-?cast .{0,20}(identity|self)/i],
  },
  {
    id: 8,
    name: "Manufactured-dependency close",
    tacticPatterns: [
      /manufactured[- ]dependency/i,
      /parasite destabiliz/i,
      /(create|invent|manufacture) .{0,30}(unsolvable|insoluble) problem/i,
      /problem .{0,25}only .{0,25}(your |the )?(product|offer|course|service) .{0,15}(solves|fixes|exit)/i,
    ],
  },
  {
    id: 9,
    name: "Subscribe-guilt honesty reframe",
    tacticPatterns: [
      /subscribe[- ]guilt/i,
      /(use|using|deploy) honesty .{0,20}(as|as a) .{0,15}(compliance|lever|tactic)/i,
    ],
  },
  {
    id: 10,
    name: "Reticular priming / covert filter-installation",
    tacticPatterns: [
      /reticular priming/i,
      /install\w* .{0,25}(perceptual )?filter/i,
    ],
  },
  {
    id: 11,
    name: "Covert blind-spot ID / covert diagnostic",
    tacticPatterns: [
      /blind-?spot (id|protocol|identif)/i,
      /covert(ly)? (profile|diagnos)/i,
      /\d+-question .{0,15}(covert )?(diagnostic|profile)/i,
    ],
  },
  {
    id: 12,
    name: "Counterfactual identity test",
    tacticPatterns: [
      /counterfactual identity/i,
      /identity-destabiliz/i,
      /(question|test) .{0,30}no (safe|good) answer/i,
    ],
  },
  {
    id: 13,
    name: "Moral-framing generator",
    tacticPatterns: [
      /moral(ly)? (load|frame|framing|charg)\w*.{0,30}(dissent|disagree|criticism|doubt|question)/i,
      /make (disagreeing|disagreement|criticism|questioning|doubt) feel (immoral|unethical|wrong|evil|shameful)/i,
    ],
  },
  {
    id: 14,
    name: "Covert meta-demonstration / run-the-loop-on-audience",
    tacticPatterns: [
      /run(ning)? the (full |entire )?(loop|sequence) on (your|the) (audience|viewer|reader)/i,
      /covert meta-demonstrat/i,
    ],
  },
] as const;

// ── Prescriptive-framing detector (the necessary second condition) ──────────

/**
 * Advisory / second-person-directive markers. A tactic mention only trips if the SAME sentence
 * also carries prescriptive framing — this is what excludes third-person descriptive audit use
 * ("this video uses X") while catching coaching ("use X to…", "you should X").
 */
const PRESCRIPTIVE_FRAMING: RegExp[] = [
  /\byou (should|can|could|need to|must|want to|have to|might|ought to|could try)\b/i,
  /\b(here'?s|this is) how (you|to)\b/i,
  /\bthe (trick|key|secret|move|play|idea|goal|technique|method) (is|here is) to\b/i,
  /\bin order to (make|get|trigger|induce|force|lead|push)\b/i,
  /\bto (make|get|trigger|induce|force|lead|push) (them|people|the (viewer|audience|reader))\b/i,
  /\btry (to |and )?\w+ing\b/i,
  /\b(start|begin) by \w+ing\b/i,
];

/** Sentence-initial imperative verbs that imply a directive when paired with a named tactic. */
const IMPERATIVE_LEAD =
  /^(use|deploy|apply|trigger|induce|install|create|manufacture|make|get|force|exploit|leverage|reach|run|build|plant|implant|lock|frame)\b/i;

function hasPrescriptiveFraming(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (IMPERATIVE_LEAD.test(trimmed)) return true;
  return PRESCRIPTIVE_FRAMING.some((re) => re.test(trimmed));
}

/**
 * Defensive-context veto. A sentence that REFUSES the tactic or frames it for RECOGNITION
 * ("I won't script…", "so you can spot it", "when it appears in content") is the opposite of
 * coaching — it must never trip, even though it names the tactic. This is what lets the model
 * give its best explanatory refusal without the tripwire halting it (caught a real false-positive
 * on the confabulated-memory red-team case).
 */
// First-person refusal by the assistant ("I won't script…", "I can't provide…", "I refuse to…").
const SELF_REFUSAL =
  /\bi(['’]?m| am| will)?\s*(won'?t|will not|can'?t|cannot|refuse|am not going to|not going to|decline|do not|don'?t)\b/i;
// Recognition / audit framing — naming a tactic so it can be SPOTTED, never deployed.
const RECOGNITION =
  /\b(recogniz\w*|recognis\w*|spot(s|ting)?\b|identif\w*|detect\w*|notice|aware of|watch (out )?for|red flag|when it appears|in (others'?|someone else'?s|their) content|defend against|protect against|avoid falling|learn to see)\b/i;

function isDefensiveContext(sentence: string): boolean {
  return SELF_REFUSAL.test(sentence) || RECOGNITION.test(sentence);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface GateResult {
  /** True when an EXCLUDE tactic is being coached (tactic + prescriptive framing). */
  tripped: boolean;
  /** The matched EXCLUDE item, when tripped. */
  item?: ExcludeItem;
  /** The offending sentence, for logging/eval. */
  sentence?: string;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+|\n+/;

/**
 * Scan free-form text for COACHING of an EXCLUDE tactic. Trips per-sentence: a named tactic plus
 * prescriptive framing in the same sentence. Descriptive/audit mentions (no prescriptive framing)
 * do not trip. Returns the first hit.
 */
export function scanForExcludedCoaching(text: string): GateResult {
  if (!text) return { tripped: false };
  const sentences = text.split(SENTENCE_SPLIT);
  for (const sentence of sentences) {
    if (!hasPrescriptiveFraming(sentence)) continue;
    if (isDefensiveContext(sentence)) continue; // refusal / recognition framing — not coaching
    for (const item of EXCLUDE_REGISTRY) {
      if (item.tacticPatterns.some((re) => re.test(sentence))) {
        return { tripped: true, item, sentence: sentence.trim() };
      }
    }
  }
  return { tripped: false };
}

// ── Tier 1: prompt-prevention block (primary defense) ───────────────────────

/**
 * The behavioral-influence ethics stance, injected into the chat system prompt. This is the
 * PRIMARY enforcement tier — it prevents the model from generating a violation in the first place,
 * which is the only enforcement that works cleanly on a live token stream.
 *
 * The never-coach list is generated from {@link EXCLUDE_REGISTRY} so the prompt and the realtime
 * tripwire can never reference different sets of tactics.
 */
export function buildEthicsPromptBlock(): string {
  const neverCoach = EXCLUDE_REGISTRY.map((i) => i.name).join("; ");
  return [
    `BEHAVIORAL-INFLUENCE ETHICS (always enforced):`,
    `- You understand persuasion and influence deeply. EXPLAIN why a technique works on people,`,
    `  and FLAG it when you see it in the analyzed content — that is your job. But NEVER give the`,
    `  user a step-by-step to run a covert-manipulation technique on their own viewers.`,
    `  Diagnose, don't prescribe.`,
    `- When you note an influence mechanism is working, say which way it points: does it serve the`,
    `  viewer's own goals (liberation), or capture/extract from them (capture)? Name the direction.`,
    `- NEVER coach, script, or give how-to for these tactics — you MAY still name them when`,
    `  flagging someone else's content: ${neverCoach}.`,
    `- If asked to deploy one of these on an audience, decline and offer the mechanism explanation`,
    `  instead, so the user can recognize it rather than wield it.`,
  ].join("\n");
}

/** The user-facing replacement when the tripwire halts a response. */
export const GATE_REFUSAL =
  "I can explain *why* an influence technique works on people, or flag it when I spot it in " +
  "content — but I won't hand you a step-by-step to deploy this one. Want the mechanism explained " +
  "instead, so you can recognize it?";

/**
 * Streaming helper. Feed it the buffer accumulated so far; it returns the SAFE prefix that is
 * cleared to forward (complete sentences scanned clean), the unflushed remainder, and whether a
 * tripwire halt fired. The route forwards `safe`, holds `remainder` until the next chunk, and on
 * `halt` stops the stream and emits {@link GATE_REFUSAL}.
 */
export function gateStreamBuffer(buffer: string): {
  safe: string;
  remainder: string;
  halt: boolean;
  result: GateResult;
} {
  // Find the last sentence boundary; only completed sentences are scannable/flushable.
  const lastBoundary = Math.max(
    buffer.lastIndexOf(". "),
    buffer.lastIndexOf("! "),
    buffer.lastIndexOf("? "),
    buffer.lastIndexOf("\n"),
  );
  if (lastBoundary === -1) {
    // No complete sentence yet — hold everything.
    return { safe: "", remainder: buffer, halt: false, result: { tripped: false } };
  }
  const complete = buffer.slice(0, lastBoundary + 1);
  const remainder = buffer.slice(lastBoundary + 1);
  const result = scanForExcludedCoaching(complete);
  if (result.tripped) {
    return { safe: "", remainder: "", halt: true, result };
  }
  return { safe: complete, remainder, halt: false, result };
}

/**
 * Stream-gate driver. Consumes an async stream of token deltas, forwards only scanned-clean
 * completed sentences via `emit`, and on an EXCLUDE coaching trip stops forwarding and emits
 * {@link GATE_REFUSAL} instead. Returns the user-visible content (what was emitted) and whether
 * a halt fired. This is the testable core the chat route wraps around the Qwen stream.
 *
 * UX note: forwarding is per-completed-sentence (not per-token) — the cost of gating before the
 * user sees text. Sentences are small, so the reveal stays responsive.
 */
export async function gateAsyncDeltas(
  deltas: AsyncIterable<string>,
  emit: (text: string) => void,
): Promise<{ content: string; halted: boolean }> {
  let content = "";
  let buffer = "";
  let halted = false;

  const haltWithRefusal = () => {
    halted = true;
    const refusal = (content ? "\n\n" : "") + GATE_REFUSAL;
    content += refusal;
    emit(refusal);
  };

  for await (const delta of deltas) {
    if (!delta) continue;
    buffer += delta;
    const gated = gateStreamBuffer(buffer);
    if (gated.safe) {
      content += gated.safe;
      emit(gated.safe);
    }
    buffer = gated.remainder;
    if (gated.halt) {
      haltWithRefusal();
      return { content, halted };
    }
  }

  // Flush the trailing partial sentence (no terminal punctuation) after the stream ends.
  if (buffer) {
    const tail = scanForExcludedCoaching(buffer);
    if (tail.tripped) {
      haltWithRefusal();
    } else {
      content += buffer;
      emit(buffer);
    }
  }
  return { content, halted };
}
