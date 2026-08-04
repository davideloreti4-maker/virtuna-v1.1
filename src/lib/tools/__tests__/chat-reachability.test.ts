/**
 * chat-reachability.test.ts — the drift guard for "can a creator get to this skill by talking?"
 *
 * Chat is the product's main door. When agent→skill routing broke it stayed broken for 18 days
 * under ~5,000 green tests, because nothing anywhere asserted that a skill is REACHABLE — only
 * that each piece works once you call it. Coverage silently regressed the same way: skills were
 * added to the app and simply never wired into the loop, and the number that mattered ("3 of 12
 * driven by the agent") existed only in a handoff document.
 *
 * So this file asserts the three closures that keep the thread coherent:
 *
 *   1. REACHABILITY — every ChatTurnKind is bound as a tool, brokered by a field, or on an
 *      explicit "no agent path" allowlist with a stated reason. A new skill cannot be silently
 *      unreachable; it must be wired or knowingly excluded.
 *   2. MEMORY — every block type a skill can persist is replayed, recorded, or knowingly excluded.
 *      This is what stops the agent going amnesiac about work the creator can see on screen.
 *   3. WIRING — every brokered action has the copy and the renderer branch it needs, so a field
 *      the model surfaces can actually run. A field that cannot submit is worse than no field.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SKILL_TOOLS } from "@/lib/tools/skill-dispatch";
import { SKILL_CAPABILITIES, SKILL_INPUT_ACTIONS } from "@/lib/tools/skill-capabilities";
import { RECORDED_BLOCKS, NON_RECORD_BLOCKS } from "@/lib/threads/chat-prior-turns";
import { BLOCK_REGISTRY } from "@/lib/tools/block-registry";
import { SKILL_RUN_META } from "@/components/thread/run-capsule";
import type { ChatTurnKind } from "@/lib/tools/chat-followups";

/**
 * Turn kinds with NO agent path, each with the reason it is excluded. An entry here is a DECISION,
 * not a gap — moving a kind out of this list is how coverage grows, and adding one should require
 * writing down why.
 */
const NO_AGENT_PATH: Record<string, string> = {
  chat: "not a skill — the conversational turn itself",
  // `simulate` and `refine` are the other two of the product's twelve creator-facing skills. They
  // are deliberately NOT ChatTurnKinds — neither renders a turn the classifier names — so they are
  // listed here as decisions rather than tested as reachable kinds.
  simulate: "the ＋door lane's own surface; the agent has no door and none is wanted",
  refine:
    "CARD-scoped: needs a cardRef + the card's content as anchor and returns ONE card. A turn-level " +
    "chip has no card in hand, and the composer's detectRefineIntent is its live door. DECIDED — do not bind.",
};

/** Every turn kind the classifier can produce — the universe reachability is measured against. */
const ALL_TURN_KINDS: ChatTurnKind[] = [
  "chat",
  "ideas",
  "hooks",
  "script",
  "remix",
  "explore",
  "account",
  "test",
  "predict",
  "profile",
  "read",
];

describe("chat reachability — every skill is bound, brokered, or knowingly excluded", () => {
  const bound = new Set(SKILL_TOOLS.map((s) => s.skillKey));
  const brokered = new Set<string>(SKILL_INPUT_ACTIONS);

  it.each(ALL_TURN_KINDS)("%s is reachable from a conversation (or explicitly is not)", (kind) => {
    const reachable = bound.has(kind) || brokered.has(kind) || kind in NO_AGENT_PATH;
    expect(
      reachable,
      `ChatTurnKind "${kind}" is not reachable from chat: it is not a bound SkillTool.skillKey, ` +
        `not a SKILL_CAPABILITIES action, and not in NO_AGENT_PATH. Either wire it, or add it to ` +
        `NO_AGENT_PATH with the reason.`,
    ).toBe(true);
  });

  it("holds the coverage line — regressions are visible as a number, not a document", () => {
    const reachable = ALL_TURN_KINDS.filter((k) => k !== "chat" && (bound.has(k) || brokered.has(k)));
    // 10 of the 10 non-chat kinds minus the two with a stated no-agent-path decision.
    expect(reachable.sort()).toEqual(
      ["account", "explore", "hooks", "ideas", "predict", "profile", "read", "remix", "script", "test"].sort(),
    );
  });

  it("binds `read` as a tool — the audience SIM, verified to touch no Apify path", () => {
    const read = SKILL_TOOLS.find((s) => s.skillKey === "read");
    expect(read, "read must be bound to the loop (tier 1)").toBeDefined();
    // A Read scores text the creator already wrote. Keyed off `draft`, never `topic` — a Read of a
    // subject the model paraphrased is a Read of the wrong thing.
    expect(read!.primaryArg).toBe("draft");
    // It spends a credit, at the same price its own route charges.
    expect(read!.billable).toBe("read");
  });

  it("does NOT bind refine — decided, and the reason is recorded", () => {
    expect(SKILL_TOOLS.some((s) => s.skillKey === "refine")).toBe(false);
    expect(NO_AGENT_PATH.refine).toMatch(/card/i);
  });

  it("leaves the scrape skills brokered, never bound — the Apify cap is not the agent's to spend", () => {
    // account-read / explore / remix hit Apify: rotating FREE accounts on a $5/month hard cap. An
    // agent that can DECIDE to scrape can exhaust it with nobody tapping anything, so these stay
    // behind a confirm tap. If one is ever promoted, that is a spending-consent decision.
    for (const scraper of ["account", "explore", "remix"]) {
      expect(bound.has(scraper), `${scraper} must stay brokered (Apify budget), not bound`).toBe(false);
      expect(brokered.has(scraper)).toBe(true);
    }
  });
});

describe("chat memory — every persisted block is represented in the anchor", () => {
  const recorded = new Set(RECORDED_BLOCKS);

  it.each(Object.keys(BLOCK_REGISTRY))("%s is replayed, recorded, or knowingly excluded", (type) => {
    const represented = recorded.has(type) || type in NON_RECORD_BLOCKS;
    expect(
      represented,
      `Block "${type}" has no representation in the chat anchor: the agent cannot see it, so a ` +
        `creator who produced one and then asked about it gets an amnesiac answer. Add a ` +
        `SKILL_BLOCK_RECORD summary, or add it to NON_RECORD_BLOCKS with the reason.`,
    ).toBe(true);
  });

  it("keeps the two sets disjoint — a block is recorded or excluded, never both", () => {
    const both = RECORDED_BLOCKS.filter((t) => t in NON_RECORD_BLOCKS);
    expect(both).toEqual([]);
  });

  it("records every non-generator SKILL result (the owner-reported memory gap)", () => {
    // The exact set that was invisible: 11% of everything persisted into the shared open thread,
    // and precisely the skills the agent does not itself run.
    for (const t of [
      "multi-audience-read",
      "outlier-grid",
      "profile-read",
      "video-test-card",
      "remix-card",
      "reaction-distribution",
      "prediction-gauge",
      "account-read",
      "brought-card",
    ]) {
      expect(recorded.has(t), `${t} must be recorded into the anchor`).toBe(true);
    }
  });
});

describe("chat wiring — a surfaced field can actually run", () => {
  it.each(SKILL_INPUT_ACTIONS)("%s has run-capsule copy", (action) => {
    expect(
      SKILL_RUN_META[action],
      `SKILL_CAPABILITIES has "${action}" but SKILL_RUN_META does not — its field would render an ` +
        `unlabeled wait.`,
    ).toBeDefined();
  });

  it.each(SKILL_INPUT_ACTIONS)("%s has a renderer branch", (action) => {
    // Source-level on purpose: the switch is the thing that drifts, and mounting the renderer
    // needs providers this guard should not depend on. A missing branch renders `null` — the
    // model announces a field and the creator sees empty space.
    const src = readFileSync(
      join(process.cwd(), "src/components/thread/input-request-block.tsx"),
      "utf8",
    );
    expect(
      src.includes(`case '${action}':`),
      `input-request-block.tsx has no "case '${action}':" branch — the field would render nothing.`,
    ).toBe(true);
  });

  it.each(SKILL_INPUT_ACTIONS)("%s declares a field kind the renderer supports", (action) => {
    expect(["link", "text", "none", "upload"]).toContain(SKILL_CAPABILITIES[action].kind);
  });

  it("tells the model when to ask for each field", () => {
    for (const action of SKILL_INPUT_ACTIONS) {
      expect(SKILL_CAPABILITIES[action].when.length, `${action} needs a \`when\` line`).toBeGreaterThan(20);
    }
  });
});
