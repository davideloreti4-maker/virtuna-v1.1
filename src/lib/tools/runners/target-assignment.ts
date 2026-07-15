/**
 * target-assignment.ts — the persona ASSIGNMENT, shared by every skill that writes for someone.
 *
 * ─── WHY THIS IS A CONTRACT AND NOT A PROMPT ──────────────────────────────────
 *
 * Measured 2026-07-14: the calibrated audience does NOT steer generation as prompt CONTEXT.
 * 20 runs, two independent methods, both at chance — hook-line embeddings (p = 0.43) and a blind
 * judge *told exactly who the audience is* (45%, worse than a coin flip). The prompt was dumped
 * and verified: every persona and repaint was present, and the calibrated prompt was 7× richer
 * than General's. The data reached the writer. **The writer ignored it.**
 *
 * ⛔ So "put more audience text in the generation prompt" is a MEASURED, REVERTED DEAD END.
 *
 * What works instead (#299, blind judge 60% vs a 13.3% control): the persona stops being CONTEXT
 * and becomes an ASSIGNMENT carried by the OUTPUT CONTRACT. Unit N is written for person N, and
 * the model must name that person back in `targetArchetype`. Differentiation is then STRUCTURAL —
 * guaranteed by the schema — instead of prayed for. **The contract is the mechanism, not the text.**
 *
 * ─── WHY IT IS SHARED ─────────────────────────────────────────────────────────
 *
 * hooks/ideas/script all bind the same way, so the two bug-prone parts — the "name it back to me"
 * instruction and the lookup that consumes the answer — live in ONE place. They were duplicated
 * once and the duplicate is exactly where the silent-drop bug (below) would have been re-introduced.
 *
 * The CRAFT prose stays with each skill (a hook stops a scroll; an idea is a thing worth making;
 * they are not the same instruction), which is why `unit.craft` is passed in rather than switched on.
 *
 * F7 — a persona's `label` NEVER appears in any string built here. The engine binds on `archetype`;
 * the writer is briefed with `repaint`. The workspace tells users in as many words that a persona's
 * display name never reaches the model. Print a label into a prompt and the UI becomes a lie.
 */

import type { PersonaTarget } from "@/lib/audience/select-persona-targets";
import type { CardTarget } from "@/lib/tools/blocks";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";

/**
 * The per-skill copy. The SHAPE of the assignment is shared; the CRAFT is not — "the thing that
 * person would stop scrolling for" is the right brief for a hook and the wrong one for an idea.
 */
export interface TargetUnitCopy {
  /** Capitalised singular as it appears in the brief — "Hook", "Idea". */
  noun: string;
  /**
   * What "written for THIS person" means for this unit, in the skill's own craft language.
   * Owned by the runner; this module never invents craft.
   */
  craft: string;
}

/**
 * The assignment block: the numbered cast + the brief + the "name them back to me" instruction.
 *
 * ⚠️ THE SLUG INSTRUCTION IS LOAD-BEARING AND IT HAS ALREADY BITTEN ONCE. See
 * `normalizeTargetArchetype` — an earlier wording said "use the exact bracketed slug", so the
 * model returned `"[lurker]"`, brackets and all, and EVERY card silently lost its target line.
 */
export function buildTargetAssignments(targets: PersonaTarget[], unit: TargetUnitCopy): string {
  const lines = targets
    .map(
      (t, i) =>
        `${i + 1}. [${t.archetype}] ${t.repaint} (${Math.round(t.share * 100)}% of the audience)`,
    )
    .join("\n");

  const n = unit.noun;
  const example = targets[0]?.archetype ?? "saver";

  // The slug rule is identical in both shapes and it is the bug-prone line — see
  // normalizeTargetArchetype. Written once so the two shapes cannot drift apart.
  const slugRule = `Report the person this ${n.toLowerCase()} targets in "targetArchetype" — the bare slug ONLY, exactly as written
inside the brackets above and WITHOUT the brackets themselves (e.g. "${example}", not "[${example}]").`;

  // A one-card skill (script) gets a SINGULAR brief. The plural "unit 1 → person 1, unit 2 →
  // person 2, and so on" is nonsense for a run that emits exactly one thing, and a nonsense
  // instruction is how a model starts improvising.
  if (targets.length === 1) {
    return `

---

WRITE THIS ${n.toUpperCase()} FOR ONE NAMED PERSON. This is a real, calibrated segment of THIS creator's actual audience — not a persona you should invent or generalise:

${lines}

${unit.craft}
${slugRule}`;
  }

  return `

---

WRITE FOR ONE NAMED PERSON PER ${n.toUpperCase()}. These are real, calibrated segments of THIS creator's actual audience — not personas you should invent or generalise:

${lines}

${n} 1 is written for person 1. ${n} 2 is written for person 2. And so on, in order.
${unit.craft}
If the same person appears twice, write two genuinely different ways in — never a rephrase.
Report the person each ${n.toLowerCase()} targets in "targetArchetype" — the bare slug ONLY, exactly as written
inside the brackets above and WITHOUT the brackets themselves (e.g. "${example}", not "[${example}]").`;
}

/**
 * Normalize the archetype slug the model hands back.
 *
 * ⚠️ THIS EXISTS BECAUSE THE LIVE RUN CAUGHT WHAT 3,600 GREEN TESTS COULD NOT. The assignment list
 * renders each person as `1. [lurker] …`, and the contract said "use the exact bracketed slug" — so
 * the model dutifully returned `"targetArchetype": "[lurker]"`, brackets and all. The assignment map
 * is keyed on the bare slug, every lookup missed, and EVERY card silently lost its target line. The
 * writer had complied PERFECTLY (its own reasoning cited "the lurker", "the loyalist" by name) — the
 * BINDING is what broke. tsc, eslint and the entire suite were green; the feature was 100% dead on
 * the only path a user ever watches.
 *
 * The lesson is not "fix the wording" (that is done too). It is that AN EXACT-MATCH LOOKUP ON
 * FREE-FORM MODEL OUTPUT IS A SILENT-FAILURE MACHINE. Decorations a model may reasonably add —
 * brackets, quotes, backticks, spacing, case — must never be the difference between a bound target
 * and a dropped one. What must STILL fail loudly is a slug we never assigned: that is `bindTarget`'s
 * job, and it is deliberately unchanged.
 */
export function normalizeTargetArchetype(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^[[({<"'`\s]+|[\])}>"'`\s]+$/g, "") // strip wrapping brackets/quotes/backticks
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_"); // "niche deep buyer" / "niche-deep-buyer" → "niche_deep_buyer"
}

/**
 * Bind a generated unit to the reader it was written for — and attach that reader's OWN reaction.
 *
 * TWO HONESTY RULES, both of which exist because a card that names a person is making a claim:
 *
 * 1. WE ONLY NAME SOMEONE WE ACTUALLY ASSIGNED. The model's `targetArchetype` is checked against the
 *    assignment set. A missing, malformed or unassigned slug → null → the card ships with NO target
 *    line. That is the honest failure: if the writer ignored its brief, the user must see an ABSENCE,
 *    not a generic card wearing a personalised label. (It is also the runtime tripwire for the
 *    measured "writer ignores the audience" failure mode — it surfaces as cards with no target,
 *    rather than as cards that lie.)
 *
 * 2. THE REACTION IS LOOKED UP, NEVER INVENTED. `verdict`/`quote` come from the SIM persona whose
 *    archetype matches the target. If that archetype did not appear in this run's panel, both are
 *    null — we do not fabricate a reaction any more than we fabricate a band.
 *
 * Note it reports the target the MODEL named, not the one we assigned by position: if the writer
 * swapped two assignments, the truthful card is the one that says who the unit is actually for.
 * A mismatch is logged as a warning, not silently corrected.
 */
export function bindTarget(args: {
  /** Already passed through `normalizeTargetArchetype`. */
  claimedArchetype: string;
  /** Who we assigned at this generation position — for the mismatch warning only. */
  positionalTarget: PersonaTarget | undefined;
  /** The slugs we are willing to have named back at us. Empty ⇒ uncalibrated run. */
  assignments: Map<string, PersonaTarget>;
  /** This unit's SIM panel — the source of the aimed-at reader's real reaction. */
  personas: FlashPersona[];
  warnings: string[];
  /** "Hook" | "Idea" | "Script" — for the warning text. */
  unitNoun: string;
  /** A short excerpt of the unit, so a warning identifies WHICH card lost its line. */
  subject: string;
}): CardTarget | null {
  const { claimedArchetype, positionalTarget, assignments, personas, warnings, unitNoun, subject } =
    args;

  if (assignments.size === 0) return null; // uncalibrated run — nobody to name

  const claimed = assignments.get(claimedArchetype);
  if (!claimed) {
    warnings.push(
      claimedArchetype
        ? `${unitNoun} "${subject.slice(0, 40)}" claimed target "${claimedArchetype}", which was never assigned — target line dropped`
        : `${unitNoun} "${subject.slice(0, 40)}" named no target — target line dropped`,
    );
    return null;
  }

  if (positionalTarget && positionalTarget.archetype !== claimed.archetype) {
    // Not corrected — the model wrote for whoever it says it wrote for. Just say so out loud.
    warnings.push(
      `${unitNoun} targeted "${claimed.archetype}" but was assigned "${positionalTarget.archetype}" — reporting the model's target`,
    );
  }

  // The aimed-at reader's real verdict + real words. Absent from the panel → null, never invented.
  const reaction = personas.find((p) => p.archetype === claimed.archetype);

  return {
    archetype: claimed.archetype,
    // Only a CREATOR-SET name is persisted (display only — it never went near the prompt, F7).
    // When absent, the card derives the name from `archetype` at render, so improving our
    // vocabulary improves every card ever generated. See CardTargetSchema.
    ...(claimed.label ? { label: claimed.label } : {}),
    share: claimed.share,
    verdict: (reaction?.verdict as "stop" | "scroll" | undefined) ?? null,
    quote: reaction?.quote ?? null,
  };
}
